import { requestToPromise, withStore } from "./database.js";
import { createId, nowIso } from "./conversations.js";

export const MEMORY_STATUS = {
  ACTIVE: "active",
  ARCHIVED: "archived",
  REJECTED: "rejected",
};

export async function listMemories({ includeArchived = false } = {}) {
  const rows = await withStore("memories", "readonly", (store) =>
    requestToPromise(store.getAll()),
  );
  return rows
    .filter((item) => includeArchived || item.status === MEMORY_STATUS.ACTIVE)
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

export async function getMemory(id) {
  return withStore("memories", "readonly", (store) => requestToPromise(store.get(id)));
}

export async function createMemory(partial) {
  const memory = {
    id: partial.id || createId(),
    text: String(partial.text || "").trim(),
    category: partial.category || "preference",
    confidence: partial.confidence || "high",
    source: partial.source || "explicit",
    sourceConversationId: partial.sourceConversationId || null,
    createdAt: partial.createdAt || nowIso(),
    updatedAt: partial.updatedAt || nowIso(),
    lastUsedAt: partial.lastUsedAt || null,
    status: partial.status || MEMORY_STATUS.ACTIVE,
    imported: Boolean(partial.imported),
  };
  await withStore("memories", "readwrite", (store) => store.put(memory));
  return memory;
}

export async function updateMemory(id, patch) {
  return withStore("memories", "readwrite", async (store) => {
    const current = await requestToPromise(store.get(id));
    if (!current) return null;
    const next = { ...current, ...patch, updatedAt: nowIso() };
    store.put(next);
    return next;
  });
}

export async function deleteMemory(id) {
  await withStore("memories", "readwrite", (store) => store.delete(id));
}

export async function clearMemories() {
  await withStore("memories", "readwrite", (store) => store.clear());
}

export async function touchMemory(id) {
  return updateMemory(id, { lastUsedAt: nowIso() });
}
