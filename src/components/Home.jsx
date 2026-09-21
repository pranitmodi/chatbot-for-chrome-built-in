import { NavIcon } from "./Icons.jsx";

export function Home({ onView, onStartChat, phase, recent, notes, capabilities, offline }) {
  const primary = [
    { id: "chat", label: "Chat", hint: "Ask anything locally" },
    { id: "page", label: "Analyze", hint: "Summarize or question long text" },
    {
      id: "image",
      label: "Image",
      hint: capabilities.image ? "Describe what’s on screen" : "Needs image-capable Chrome",
    },
  ];
  const more = [
    { id: "summarize", label: "Summarize", icon: "summarize" },
    { id: "rewrite", label: "Rewrite", icon: "rewrite" },
    { id: "proofread", label: "Proofread", icon: "proofread" },
    { id: "study", label: "Study", icon: "study" },
    { id: "notes", label: "Notes", icon: "notes" },
    { id: "memory", label: "Memory", icon: "memory" },
    { id: "status", label: "Status", icon: "status" },
  ];

  return (
    <div className="home">
      <header className="home-hero">
        <p className="eyebrow">
          {offline ? "Offline-ready when the model is prepared" : "On-device in Chrome"}
        </p>
        <h2>What do you want to do?</h2>
        <p>
          AI processing happens on your device when Local AI is active. No account and no API key.
        </p>
        <button type="button" className="prepare-btn home-cta" onClick={() => (onStartChat ? onStartChat() : onView("chat"))}>
          {phase && phase !== "ready" ? "Set up Local AI" : "Start chatting"}
        </button>
      </header>

      <div className="primary-grid">
        {primary.map((tool) => (
          <button
            key={tool.id}
            type="button"
            className="tool-card featured"
            onClick={() => onView(tool.id)}
          >
            <strong>{tool.label}</strong>
            <span>{tool.hint}</span>
          </button>
        ))}
      </div>

      <section className="home-block">
        <p className="nav-label">More tools</p>
        <div className="more-tools">
          {more.map((tool) => (
            <button key={tool.id} type="button" className="chip-btn" onClick={() => onView(tool.id)}>
              <NavIcon name={tool.icon} />
              {tool.label}
            </button>
          ))}
        </div>
      </section>

      <section className="home-recent">
        <div className="home-block">
          <div className="section-head">
            <h3>Recent chats</h3>
            {recent.length ? (
              <button type="button" className="text-btn" onClick={() => onView("chat")}>
                Open chat
              </button>
            ) : null}
          </div>
          {recent.length === 0 ? (
            <p className="muted">Nothing saved yet. Start a chat and it will appear here.</p>
          ) : (
            <ul className="recent-list">
              {recent.slice(0, 6).map((item) => (
                <li key={item.id}>
                  <button type="button" onClick={() => onView("chat", item.id)}>
                    {item.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="home-block">
          <div className="section-head">
            <h3>Notes</h3>
            <button type="button" className="text-btn" onClick={() => onView("notes")}>
              All notes
            </button>
          </div>
          {notes.length === 0 ? (
            <p className="muted">Save a reply from chat when something is worth keeping.</p>
          ) : (
            <ul className="recent-list">
              {notes.slice(0, 4).map((note) => (
                <li key={note.id}>
                  <button type="button" onClick={() => onView("notes")}>
                    {note.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
