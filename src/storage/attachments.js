import { requestToPromise, withStore } from "./database.js";
import { createId } from "./conversations.js";

function blobFromUnknown(value) {
  if (!value) return null;
  if (value instanceof Blob) return value;
  return null;
}

export async function saveAttachment(attachment) {
  const id = attachment.id || createId();
  const blob = blobFromUnknown(attachment.modelValue) || blobFromUnknown(attachment.blob);
  const frames = (attachment.frames || []).filter((frame) => frame instanceof Blob);
  const record = {
    id,
    conversationId: attachment.conversationId || null,
    messageId: attachment.messageId || null,
    kind: attachment.kind,
    name: attachment.name || "Attachment",
    size: attachment.size || blob?.size || 0,
    mime: blob?.type || attachment.mime || "",
    blob,
    frames,
    frameCount: attachment.frameCount || frames.length || null,
  };
  await withStore("attachments", "readwrite", (store) => store.put(record));
  return record;
}

export async function getAttachment(id) {
  return withStore("attachments", "readonly", (store) => requestToPromise(store.get(id)));
}

export async function hydrateAttachments(ids) {
  const result = [];
  for (const id of ids || []) {
    const record = await getAttachment(id);
    if (!record) continue;
    result.push(toUiAttachment(record));
  }
  return result;
}

export function toUiAttachment(record) {
  const previewSource =
    record.kind === "video" ? record.frames?.[0] : record.blob;
  return {
    id: record.id,
    kind: record.kind,
    name: record.name,
    size: record.size,
    previewUrl: previewSource ? URL.createObjectURL(previewSource) : "",
    modelValue: record.blob,
    frames: record.frames || null,
    frameCount: record.frameCount,
  };
}

export async function listOrphanAttachments() {
  return withStore("attachments", "readonly", async (store) => {
    const all = await requestToPromise(store.getAll());
    return all.filter((item) => !item.conversationId && !item.messageId);
  });
}

export async function deleteAttachment(id) {
  await withStore("attachments", "readwrite", (store) => store.delete(id));
}

export async function cleanupOrphanAttachments() {
  const orphans = await listOrphanAttachments();
  for (const item of orphans) {
    await deleteAttachment(item.id);
  }
  return orphans.length;
}

export async function listAllAttachments() {
  return withStore("attachments", "readonly", (store) => requestToPromise(store.getAll()));
}
