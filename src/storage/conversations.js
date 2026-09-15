import { requestToPromise, withStore, withStores } from "./database.js";

export function nowIso() {
  return new Date().toISOString();
}

export function createId() {
  return crypto.randomUUID();
}

export function deriveTitle(text) {
  const line = (text || "").replace(/\s+/g, " ").trim();
  if (!line) return "New conversation";
  return line.length > 48 ? `${line.slice(0, 45).trim()}…` : line;
}

export async function listConversations() {
  const rows = await withStore("conversations", "readonly", (store) =>
    requestToPromise(store.getAll()),
  );
  return rows.sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    return (b.updatedAt || "").localeCompare(a.updatedAt || "");
  });
}

export async function getConversation(id) {
  return withStore("conversations", "readonly", (store) => requestToPromise(store.get(id)));
}

export async function createConversation(partial = {}) {
  const conversation = {
    title: "New conversation",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    pinned: false,
    rememberEnabled: true,
    ...partial,
    id: partial.id || createId(),
  };
  if (!conversation.createdAt) conversation.createdAt = nowIso();
  if (!conversation.updatedAt) conversation.updatedAt = nowIso();
  await withStore("conversations", "readwrite", (store) => store.put(conversation));
  return conversation;
}

export async function updateConversation(id, patch) {
  return withStore("conversations", "readwrite", async (store) => {
    const current = await requestToPromise(store.get(id));
    if (!current) return null;
    const next = { ...current, ...patch, updatedAt: patch.updatedAt || nowIso() };
    store.put(next);
    return next;
  });
}

export async function deleteConversation(id) {
  await withStores(["conversations", "messages", "attachments"], "readwrite", async (stores) => {
    stores.conversations.delete(id);
    const messages = await requestToPromise(stores.messages.index("conversationId").getAll(id));
    for (const message of messages) {
      stores.messages.delete(message.id);
    }
    const attachments = await requestToPromise(
      stores.attachments.index("conversationId").getAll(id),
    );
    for (const attachment of attachments) {
      stores.attachments.delete(attachment.id);
    }
  });
}

export async function duplicateConversation(id) {
  const source = await getConversation(id);
  if (!source) return null;
  const copy = await createConversation({
    title: `${source.title} copy`,
    pinned: false,
    rememberEnabled: source.rememberEnabled,
  });
  const { listMessages } = await import("./messages.js");
  const { saveAttachment } = await import("./attachments.js");
  const messages = await listMessages(id);
  for (const message of messages) {
    const attachmentIds = [];
    for (const attachment of message.attachments || []) {
      const saved = await saveAttachment({
        ...attachment,
        id: createId(),
        conversationId: copy.id,
        messageId: null,
      });
      attachmentIds.push(saved.id);
    }
    const { putMessage } = await import("./messages.js");
    await putMessage({
      ...message,
      id: createId(),
      conversationId: copy.id,
      attachmentIds,
      createdAt: nowIso(),
    });
  }
  return copy;
}
