import { useEffect, useState } from "react";
import { createNote, deleteNote, listNotes, updateNote } from "../storage/notes.js";
import { openDraft } from "../features/drafts.js";

export function NotesView() {
  const [notes, setNotes] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [draft, setDraft] = useState("");
  const [title, setTitle] = useState("");
  const [query, setQuery] = useState("");
  const [saveState, setSaveState] = useState("");

  async function refresh() {
    const rows = await listNotes();
    setNotes(rows);
    if (!activeId && rows[0]) {
      setActiveId(rows[0].id);
      setTitle(rows[0].title);
      setDraft(rows[0].content);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const active = notes.find((note) => note.id === activeId);
  const visible = notes.filter((note) =>
    `${note.title} ${note.content}`.toLowerCase().includes(query.trim().toLowerCase()),
  );

  useEffect(() => {
    if (!activeId || !active) return undefined;
    setSaveState("Saving…");
    const timer = window.setTimeout(async () => {
      await updateNote(activeId, { title, content: draft });
      setSaveState("Saved locally");
    }, 500);
    return () => window.clearTimeout(timer);
  }, [activeId, title, draft]);

  return (
    <div className="split-page">
      <div className="split-list">
        <div className="sidebar-heading">
          <h2>Notes</h2>
          <button
            type="button"
            className="text-btn"
            onClick={async () => {
              const note = await createNote({ title: "Untitled note", content: "", sourceType: "manual" });
              await refresh();
              setActiveId(note.id);
              setTitle(note.title);
              setDraft("");
            }}
          >
            New
          </button>
        </div>
        <input
          className="note-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search notes"
          aria-label="Search notes"
        />
        {visible.map((note) => (
          <button
            key={note.id}
            type="button"
            className={note.id === activeId ? "conv-item active" : "conv-item"}
            onClick={() => {
              setActiveId(note.id);
              setTitle(note.title);
              setDraft(note.content);
            }}
          >
            {note.pinned ? "📌 " : ""}
            {note.title}
          </button>
        ))}
      </div>
      <div className="split-main">
        {active ? (
          <>
            <input
              className="title-input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              aria-label="Note title"
            />
            <textarea
              className="panel-input"
              rows={16}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              aria-label="Note content"
            />
            <p className="autosave-state" role="status">{saveState}</p>
            <div className="panel-actions">
              <button
                type="button"
                className="prepare-btn"
                onClick={() => openDraft("chat", draft, title)}
              >
                Continue in Chat
              </button>
              <button type="button" className="text-btn" onClick={() => openDraft("summarize", draft, title)}>
                Summarize
              </button>
              <button type="button" className="text-btn" onClick={() => openDraft("rewrite", draft, title)}>
                Rewrite
              </button>
              <button
                type="button"
                className="text-btn"
                onClick={async () => {
                  await updateNote(active.id, { pinned: !active.pinned });
                  refresh();
                }}
              >
                {active.pinned ? "Unpin" : "Pin"}
              </button>
              <button
                type="button"
                className="text-btn"
                onClick={async () => {
                  await deleteNote(active.id);
                  setActiveId(null);
                  setTitle("");
                  setDraft("");
                  refresh();
                }}
              >
                Delete
              </button>
            </div>
          </>
        ) : (
          <div className="empty-card">
            <h2>{notes.length ? "No matching note" : "Keep useful local results"}</h2>
            <p className="lede">
              {notes.length
                ? "Try another search or choose a note."
                : "Create a note here, or save any response from Chat and tools."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
