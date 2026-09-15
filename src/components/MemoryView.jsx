import { useEffect, useMemo, useState } from "react";
import {
  MEMORY_STATUS,
  clearMemories,
  createMemory,
  deleteMemory,
  listMemories,
  updateMemory,
} from "../storage/memories.js";
import { getSetting, setSetting } from "../storage/settings.js";
import { downloadJson, exportAll, importAll, validateExportPayload } from "../storage/exportImport.js";
import { EXPORT_MEMORY_TITLE, IMPORT_MEMORY_TITLE } from "../features/exportHints.js";
import { SearchIcon } from "./Icons.jsx";

const FILTERS = [
  { id: "active", label: "Active" },
  { id: "archived", label: "Archived" },
  { id: "all", label: "All" },
];

export function MemoryView() {
  const [memories, setMemories] = useState([]);
  const [enabled, setEnabled] = useState(true);
  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState("active");
  const [query, setQuery] = useState("");

  async function refresh() {
    setMemories(await listMemories({ includeArchived: true }));
    setEnabled(Boolean(await getSetting("memoryEnabled", true)));
  }

  useEffect(() => {
    refresh();
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return memories.filter((memory) => {
      if (filter === "active" && memory.status !== MEMORY_STATUS.ACTIVE) return false;
      if (filter === "archived" && memory.status !== MEMORY_STATUS.ARCHIVED) return false;
      if (!q) return true;
      return (
        memory.text.toLowerCase().includes(q) ||
        String(memory.source || "").toLowerCase().includes(q) ||
        String(memory.category || "").toLowerCase().includes(q)
      );
    });
  }, [memories, filter, query]);

  const counts = useMemo(() => {
    const active = memories.filter((m) => m.status === MEMORY_STATUS.ACTIVE).length;
    const archived = memories.filter((m) => m.status === MEMORY_STATUS.ARCHIVED).length;
    return { active, archived, all: memories.length };
  }, [memories]);

  return (
    <div className="panel-page memory-page">
      <header className="panel-intro">
        <p className="lede">
          Selective facts Local AI can reuse across chats — not a dump of every conversation. Stored
          only in this browser. Never save passwords, tokens, or secrets.
        </p>
      </header>

      <section className="privacy-card memory-guide">
        <h3>How to use memory</h3>
        <ul>
          <li>
            In chat, say <code>Remember that I prefer short answers</code> or{" "}
            <code>Forget that I use macOS</code>.
          </li>
          <li>
            Ask <code>What do you remember?</code> to list what is stored.
          </li>
          <li>Or add a note below. Turn Memory off anytime to stop injecting context.</li>
        </ul>
      </section>

      <div className="memory-toolbar">
        <label className="memory-switch">
          <input
            type="checkbox"
            checked={enabled}
            onChange={async (event) => {
              await setSetting("memoryEnabled", event.target.checked);
              setEnabled(event.target.checked);
            }}
          />
          <span className="memory-switch-track" aria-hidden="true" />
          <span className="memory-switch-copy">
            <strong>Memory {enabled ? "on" : "off"}</strong>
            <small>{enabled ? "Facts can be reused in chat" : "Nothing is injected into chat"}</small>
          </span>
        </label>
        <div className="memory-actions">
          <button
            type="button"
            className="text-btn"
            title={EXPORT_MEMORY_TITLE}
            aria-label={EXPORT_MEMORY_TITLE}
            onClick={async () => {
              const data = await exportAll();
              downloadJson(`local-ai-memory-${Date.now()}.json`, {
                version: data.version,
                exportedAt: data.exportedAt,
                memories: data.memories,
              });
            }}
          >
            Export
          </button>
          <label className="text-btn" title={IMPORT_MEMORY_TITLE} aria-label={IMPORT_MEMORY_TITLE}>
            Import
            <input
              className="hidden-input"
              type="file"
              accept="application/json"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const payload = JSON.parse(await file.text());
                validateExportPayload(payload);
                await importAll(payload);
                refresh();
                event.target.value = "";
              }}
            />
          </label>
          <button
            type="button"
            className="text-btn danger-text"
            onClick={async () => {
              if (window.confirm("Clear all local memory?")) {
                await clearMemories();
                refresh();
              }
            }}
          >
            Clear all
          </button>
        </div>
      </div>

      <section className="memory-compose" aria-label="Add a memory">
        <label className="memory-compose-label" htmlFor="memory-draft">
          Add a memory
        </label>
        <div className="memory-compose-row">
          <input
            id="memory-draft"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Remember that I prefer short answers…"
            aria-label="New memory"
            onKeyDown={async (event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              if (!draft.trim()) return;
              await createMemory({ text: draft.trim(), source: "explicit", confidence: "high" });
              setDraft("");
              refresh();
            }}
          />
          <button
            type="button"
            className="prepare-btn"
            disabled={!draft.trim()}
            onClick={async () => {
              if (!draft.trim()) return;
              await createMemory({ text: draft.trim(), source: "explicit", confidence: "high" });
              setDraft("");
              refresh();
            }}
          >
            Save
          </button>
        </div>
      </section>

      <div className="memory-filters">
        <div className="mode-row memory-filter-row" role="tablist" aria-label="Memory filters">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={filter === item.id}
              className={filter === item.id ? "chip-btn active" : "chip-btn"}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
              <span className="chip-count">{counts[item.id]}</span>
            </button>
          ))}
        </div>
        <div className="memory-search">
          <SearchIcon />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search memories"
            aria-label="Search memories"
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="muted memory-empty">
          {memories.length === 0
            ? "No memories yet. Save one above, or say “Remember that…” in chat."
            : "Nothing matches this filter."}
        </p>
      ) : (
        <ul className="memory-list">
          {visible.map((memory) => (
            <li key={memory.id} className={memory.status !== MEMORY_STATUS.ACTIVE ? "is-archived" : ""}>
              <p className="memory-text">
                {memory.text} {memory.imported ? <small className="memory-tag">imported</small> : null}
              </p>
              <div className="memory-meta">
                <span className="memory-tag">{memory.category || "general"}</span>
                <span className="memory-tag">{memory.source}</span>
                <span className="memory-tag">{memory.confidence}</span>
                <span className="memory-tag">{memory.status}</span>
              </div>
              <div className="panel-actions memory-item-actions">
                <button
                  type="button"
                  className="text-btn"
                  onClick={async () => {
                    const text = window.prompt("Edit memory", memory.text);
                    if (text) {
                      await updateMemory(memory.id, { text });
                      refresh();
                    }
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="text-btn"
                  onClick={async () => {
                    const next =
                      memory.status === MEMORY_STATUS.ARCHIVED
                        ? MEMORY_STATUS.ACTIVE
                        : MEMORY_STATUS.ARCHIVED;
                    await updateMemory(memory.id, { status: next });
                    refresh();
                  }}
                >
                  {memory.status === MEMORY_STATUS.ARCHIVED ? "Restore" : "Archive"}
                </button>
                <button
                  type="button"
                  className="text-btn"
                  onClick={async () => {
                    await deleteMemory(memory.id);
                    refresh();
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
