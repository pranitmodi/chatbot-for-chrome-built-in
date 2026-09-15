import { requestToPromise, withStore, withStores } from "./database.js";
import { createId, nowIso, updateConversation } from "./conversations.js";
import { hydrateAttachments, saveAttachment } from "./attachments.js";

export async function listMessages(conversationId) {
  const rows = await withStore("messages", "readonly", (store) =>
    requestToPromise(store.index("conversationId").getAll(conversationId)),
  );
  rows.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
  const hydrated = [];
  for (const row of rows) {
    hydrated.push({
      ...row,
      attachments: await hydrateAttachments(row.attachmentIds || []),
    });
  }
  return hydrated;
}

export async function putMessage(message) {
  const record = {
    id: message.id || createId(),
    conversationId: message.conversationId,
    role: message.role,
    content: message.content ?? message.text ?? "",
    createdAt: message.createdAt || nowIso(),
    stopped: Boolean(message.stopped),
    attachmentIds: message.attachmentIds || [],
  };
  await withStore("messages", "readwrite", (store) => store.put(record));
  if (message.conversationId) {
    await updateConversation(message.conversationId, {});
  }
  return record;
}

export async function saveUserTurn({ conversationId, text, attachments = [] }) {
  const messageId = createId();
  const attachmentIds = [];
  for (const attachment of attachments) {
    const saved = await saveAttachment({
      ...attachment,
      conversationId,
      messageId,
    });
    attachmentIds.push(saved.id);
  }
  const record = await putMessage({
    id: messageId,
    conversationId,
    role: "user",
    content: text,
    attachmentIds,
  });
  return { ...record, attachments: await hydrateAttachments(attachmentIds) };
}

export async function saveAssistantPlaceholder(conversationId) {
  const record = await putMessage({
    conversationId,
    role: "assistant",
    content: "",
  });
  return { ...record, text: "", attachments: [] };
}

export async function updateMessageContent(id, content, extra = {}) {
  return withStore("messages", "readwrite", async (store) => {
    const current = await requestToPromise(store.get(id));
    if (!current) return null;
    const next = { ...current, content, ...extra };
    store.put(next);
    return next;
  });
}

export async function deleteMessage(id) {
  await withStores(["messages", "attachments"], "readwrite", async (stores) => {
    const message = await requestToPromise(stores.messages.get(id));
    if (!message) return;
    stores.messages.delete(id);
    for (const attachmentId of message.attachmentIds || []) {
      stores.attachments.delete(attachmentId);
    }
  });
}

export function toUiMessage(record) {
  return {
    id: record.id,
    role: record.role,
    text: record.content || record.text || "",
    attachments: record.attachments || [],
    stopped: Boolean(record.stopped),
    createdAt: record.createdAt,
  };
}
