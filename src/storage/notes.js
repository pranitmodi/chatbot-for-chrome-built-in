import { requestToPromise, withStore } from "./database.js";
import { createId, nowIso } from "./conversations.js";

export async function listNotes() {
  const rows = await withStore("notes", "readonly", (store) => requestToPromise(store.getAll()));
  return rows.sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    return (b.updatedAt || "").localeCompare(a.updatedAt || "");
  });
}

export async function getNote(id) {
  return withStore("notes", "readonly", (store) => requestToPromise(store.get(id)));
}

export async function createNote(partial = {}) {
  const note = {
    id: partial.id || createId(),
    title: partial.title || deriveNoteTitle(partial.content || ""),
    content: partial.content || "",
    createdAt: partial.createdAt || nowIso(),
    updatedAt: partial.updatedAt || nowIso(),
    pinned: Boolean(partial.pinned),
    sourceType: partial.sourceType || "manual",
    sourceReference: partial.sourceReference || null,
  };
  await withStore("notes", "readwrite", (store) => store.put(note));
  return note;
}

export async function updateNote(id, patch) {
  return withStore("notes", "readwrite", async (store) => {
    const current = await requestToPromise(store.get(id));
    if (!current) return null;
    const next = { ...current, ...patch, updatedAt: nowIso() };
    if (patch.content && !patch.title) {
      next.title = current.title || deriveNoteTitle(patch.content);
    }
    store.put(next);
    return next;
  });
}

export async function deleteNote(id) {
  await withStore("notes", "readwrite", (store) => store.delete(id));
}

export function deriveNoteTitle(content) {
  const line = (content || "").replace(/\s+/g, " ").trim();
  if (!line) return "Untitled note";
  return line.length > 48 ? `${line.slice(0, 45).trim()}…` : line;
}
