import { listConversations, getConversation, createConversation } from "./conversations.js";
import { listMessages, putMessage } from "./messages.js";
import { listAllAttachments, saveAttachment } from "./attachments.js";
import { listMemories, createMemory, clearMemories } from "./memories.js";
import { listNotes, createNote } from "./notes.js";
import { getAllSettings, replaceSettings } from "./settings.js";

const EXPORT_VERSION = 1;

function blobToBase64(blob) {
  if (!blob) return null;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64, mime) {
  if (!base64) return null;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime || "application/octet-stream" });
}

export function validateExportPayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Import file is not a JSON object.");
  }
  if (payload.version !== EXPORT_VERSION) {
    throw new Error("This export version is not supported.");
  }
  for (const key of ["conversations", "messages", "notes", "memories"]) {
    if (payload[key] && !Array.isArray(payload[key])) {
      throw new Error(`Import field "${key}" must be an array.`);
    }
  }
  return true;
}

export async function exportAll() {
  const conversations = await listConversations();
  const notes = await listNotes();
  const memories = await listMemories({ includeArchived: true });
  const settings = await getAllSettings();
  const attachments = await listAllAttachments();
  const messages = [];
  for (const conversation of conversations) {
    const rows = await listMessages(conversation.id);
    for (const row of rows) {
      messages.push({
        id: row.id,
        conversationId: row.conversationId,
        role: row.role,
        content: row.content,
        createdAt: row.createdAt,
        stopped: row.stopped,
        attachmentIds: row.attachmentIds || [],
      });
    }
  }

  const attachmentPayload = [];
  for (const attachment of attachments) {
    attachmentPayload.push({
      id: attachment.id,
      conversationId: attachment.conversationId,
      messageId: attachment.messageId,
      kind: attachment.kind,
      name: attachment.name,
      size: attachment.size,
      mime: attachment.mime,
      blob: await blobToBase64(attachment.blob),
      frames: await Promise.all((attachment.frames || []).map((frame) => blobToBase64(frame))),
      frameCount: attachment.frameCount,
    });
  }

  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    conversations,
    messages,
    notes,
    memories,
    settings,
    attachments: attachmentPayload,
  };
}

export async function importAll(payload, { replaceMemories = false } = {}) {
  validateExportPayload(payload);
  const idMap = new Map();

  for (const conversation of payload.conversations || []) {
    const created = await createConversation({
      ...conversation,
      title: conversation.title || "Imported conversation",
      id: crypto.randomUUID(),
    });
    idMap.set(conversation.id, created.id);
  }

  for (const attachment of payload.attachments || []) {
    const blob = base64ToBlob(attachment.blob, attachment.mime);
    const frames = (attachment.frames || []).map((frame) => base64ToBlob(frame, "image/jpeg"));
    const saved = await saveAttachment({
      ...attachment,
      id: undefined,
      blob,
      frames,
      conversationId: idMap.get(attachment.conversationId) || null,
    });
    idMap.set(attachment.id, saved.id);
  }

  for (const message of payload.messages || []) {
    await putMessage({
      ...message,
      id: undefined,
      conversationId: idMap.get(message.conversationId),
      attachmentIds: (message.attachmentIds || []).map((id) => idMap.get(id)).filter(Boolean),
    });
  }

  for (const note of payload.notes || []) {
    await createNote({
      ...note,
      id: undefined,
    });
  }

  if (replaceMemories) {
    await clearMemories();
  }
  for (const memory of payload.memories || []) {
    await createMemory({
      ...memory,
      id: undefined,
      imported: true,
      source: memory.source || "imported",
    });
  }

  if (payload.settings && typeof payload.settings === "object") {
    await replaceSettings(payload.settings);
  }
}

export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function toMarkdownExport(conversations, messageMap) {
  const parts = ["# Local AI export", ""];
  for (const conversation of conversations) {
    parts.push(`## ${conversation.title}`, "");
    for (const message of messageMap.get(conversation.id) || []) {
      parts.push(`**${message.role}:**`, "", message.content || message.text || "", "");
    }
  }
  return parts.join("\n");
}
