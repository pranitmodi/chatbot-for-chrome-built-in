import { useEffect, useState } from "react";
import { createNote, deleteNote, listNotes, updateNote } from "../storage/notes.js";

export function NotesView() {
  const [notes, setNotes] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [draft, setDraft] = useState("");
  const [title, setTitle] = useState("");

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
        {notes.map((note) => (
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
              onBlur={() => updateNote(active.id, { title, content: draft })}
              aria-label="Note title"
            />
            <textarea
              className="panel-input"
              rows={16}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={() => updateNote(active.id, { title, content: draft })}
              aria-label="Note content"
            />
            <div className="panel-actions">
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
                  refresh();
                }}
              >
                Delete
              </button>
            </div>
          </>
        ) : (
          <p className="lede">No note selected.</p>
        )}
      </div>
    </div>
  );
}
