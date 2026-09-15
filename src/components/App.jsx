import { useEffect, useMemo, useState } from "react";
import { Chat } from "./Chat.jsx";
import { Sidebar } from "./Sidebar.jsx";
import { Home } from "./Home.jsx";
import { NotesView } from "./NotesView.jsx";
import { MemoryView } from "./MemoryView.jsx";
import { StatusView } from "./StatusView.jsx";
import { ImageToolView } from "./ImageToolView.jsx";
import { ExplainView, PageAiView } from "./PageViews.jsx";
import { ToolWorkspace } from "./ToolWorkspace.jsx";
import { InstallApp } from "./InstallApp.jsx";
import { ModelStatus } from "./ModelStatus.jsx";
import { MoonIcon, SunIcon } from "./Icons.jsx";
import { useLocalAi } from "../hooks/useLocalAi.js";
import { parseHash, setHash, VIEW_TITLES } from "../features/navigation.js";
import {
  deleteConversation,
  duplicateConversation,
  listConversations,
  updateConversation,
} from "../storage/conversations.js";
import { listNotes } from "../storage/notes.js";
import { searchLocal } from "../storage/search.js";
import {
  buildExtractionPrompt,
  buildProofreadPrompt,
  buildRewritePrompt,
  buildStudyPrompt,
  buildSummaryPrompt,
} from "../ai/prompts.js";

const THEME_KEY = "built-in-chat-theme";

function getInitialTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") {
    return stored;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function App() {
  const [theme, setTheme] = useState(getInitialTheme);
  const [view, setView] = useState(() => parseHash().view || "chat");
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [notes, setNotes] = useState([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [collapsed, setCollapsed] = useState(false);
  const [generating, setGenerating] = useState(false);
  const localAi = useLocalAi();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const onHash = () => {
      const parsed = parseHash();
      setView(parsed.view || "chat");
    };
    window.addEventListener("hashchange", onHash);
    onHash();
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  async function refreshLists() {
    setConversations(await listConversations());
    setNotes(await listNotes());
  }

  useEffect(() => {
    refreshLists();
  }, []);

  useEffect(() => {
    const handle = setTimeout(async () => {
      if (!search.trim()) {
        setSearchResults([]);
        return;
      }
      setSearchResults(await searchLocal(search));
    }, 200);
    return () => clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    function onKey(event) {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.code === "Space") {
        event.preventDefault();
        go("chat");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function go(nextView, nextConversationId) {
    setView(nextView);
    if (nextConversationId) setConversationId(nextConversationId);
    if (nextView === "chat" && nextConversationId) {
      setHash("chat");
    } else {
      setHash(nextView);
    }
  }

  const toolProps = useMemo(
    () => ({
      provider: localAi.provider,
      phase: localAi.phase,
      prepareModel: localAi.prepareModel,
    }),
    [localAi.provider, localAi.phase, localAi.prepareModel],
  );

  let main = null;
  if (view === "home") {
    main = (
      <Home
        onView={(id, id2) => go(id, id2)}
        recent={conversations}
        notes={notes}
        capabilities={localAi.capabilities}
        offline={localAi.offline}
      />
    );
  } else if (view === "chat") {
    main = (
      <Chat
        provider={localAi.provider}
        phase={localAi.phase}
        setPhase={localAi.setPhase}
        capabilities={localAi.capabilities}
        prepareModel={localAi.prepareModel}
        error={localAi.error}
        setError={localAi.setError}
        conversationId={conversationId}
        onConversationId={setConversationId}
        onConversationsChanged={refreshLists}
        generating={generating}
        setGenerating={setGenerating}
        setContextUsage={localAi.setContextUsage}
      />
    );
  } else if (view === "page") {
    main = <PageAiView {...toolProps} />;
  } else if (view === "explain") {
    main = <ExplainView {...toolProps} />;
  } else if (view === "summarize") {
    main = (
      <ToolWorkspace
        {...toolProps}
        title="Summarize"
        description="Stay grounded in the supplied material. No web browsing."
        modes={[
          { id: "bullets3", label: "3 bullets" },
          { id: "bullets5", label: "5 bullets" },
          { id: "detailed", label: "Detailed" },
          { id: "paragraph", label: "Paragraph" },
          { id: "actions", label: "Action items" },
          { id: "facts", label: "Key facts" },
        ]}
        defaultMode="paragraph"
        placeholder="Paste text, a note, or a page extract"
        buildPrompt={buildSummaryPrompt}
      />
    );
  } else if (view === "rewrite") {
    main = (
      <ToolWorkspace
        {...toolProps}
        title="Rewrite"
        description="Meaning is preserved. The rewritten version is shown explicitly — nothing is replaced in place."
        modes={[
          { id: "clearer", label: "Clearer" },
          { id: "shorter", label: "Shorter" },
          { id: "professional", label: "Professional" },
          { id: "casual", label: "Casual" },
          { id: "simplify", label: "Simplify" },
          { id: "grammar", label: "Grammar" },
          { id: "tone", label: "Tone" },
        ]}
        defaultMode="clearer"
        placeholder="Paste text to rewrite"
        buildPrompt={buildRewritePrompt}
      />
    );
  } else if (view === "proofread") {
    main = (
      <ToolWorkspace
        {...toolProps}
        title="Proofread"
        description={
          localAi.capabilities.proofreading
            ? "Chrome's Proofreader API is available; Prompt API is the fallback."
            : "Uses the on-device Prompt API. Original, suggested version, and explanation are requested."
        }
        placeholder="Paste text to proofread"
        buildPrompt={(text) => buildProofreadPrompt(text)}
      />
    );
  } else if (view === "extract") {
    main = (
      <ToolWorkspace
        {...toolProps}
        title="Extract"
        description="Returns JSON. Nothing extracted here is executed as an action."
        placeholder="Paste unstructured text"
        buildPrompt={(text) => buildExtractionPrompt(text)}
      />
    );
  } else if (view === "image") {
    main = (
      <ImageToolView
        {...toolProps}
        capabilities={localAi.capabilities}
      />
    );
  } else if (view === "study") {
    main = (
      <ToolWorkspace
        {...toolProps}
        title="Study"
        description="Grounded in the material you provide. Local AI will not pretend to browse."
        modes={[
          { id: "summary", label: "Summary" },
          { id: "concepts", label: "Concepts" },
          { id: "flashcards", label: "Flashcards" },
          { id: "questions", label: "Questions" },
          { id: "quiz", label: "Quiz" },
          { id: "explain", label: "Explain" },
          { id: "mistakes", label: "Mistakes" },
        ]}
        defaultMode="summary"
        placeholder="Paste notes, an article extract, or study material"
        buildPrompt={buildStudyPrompt}
      />
    );
  } else if (view === "notes") {
    main = <NotesView />;
  } else if (view === "memory") {
    main = <MemoryView />;
  } else if (view === "status") {
    main = (
      <StatusView
        phase={localAi.phase}
        capabilities={localAi.capabilities}
        provider={localAi.provider}
        prepareModel={localAi.prepareModel}
        offline={localAi.offline}
        contextUsage={localAi.contextUsage}
      />
    );
  }

  return (
    <div className={`app-shell app-shell-nav ${view === "chat" ? "is-chat" : ""} ${collapsed ? "collapsed-nav" : ""}`}>
      <a className="skip-link" href="#main">Skip to main content</a>
      <Sidebar
        view={view}
        onView={(id) => go(id)}
        conversations={conversations}
        conversationId={conversationId}
        onSelectConversation={(id) => go("chat", id)}
        onNewChat={() => {
          setConversationId(null);
          localAi.provider.destroySession();
          if (localAi.phase === "ready" || localAi.phase === "error") {
            localAi.provider.createSession().then(() => {
              localAi.setContextUsage(localAi.provider.getContextUsage());
              localAi.setPhase("ready");
            }).catch(() => {});
          }
          go("chat");
        }}
        onPin={(conversation) =>
          updateConversation(conversation.id, { pinned: !conversation.pinned }).then(refreshLists)
        }
        onRename={(id, title) => updateConversation(id, { title }).then(refreshLists)}
        onDelete={async (id) => {
          await deleteConversation(id);
          if (conversationId === id) setConversationId(null);
          refreshLists();
        }}
        onDuplicate={async (id) => {
          const copy = await duplicateConversation(id);
          await refreshLists();
          if (copy) go("chat", copy.id);
        }}
        search={search}
        onSearch={setSearch}
        searchResults={searchResults}
        collapsed={collapsed}
        onToggle={() => setCollapsed((value) => !value)}
      />
      <div className="app-main" id="main">
        <header className="topbar">
          <h1 className="page-title">{VIEW_TITLES[view] || "Local AI"}</h1>
          <div className="topbar-actions">
            <ModelStatus
              phase={generating ? "ready" : localAi.phase}
              downloadProgress={localAi.downloadProgress}
              generating={generating}
              contextUsage={localAi.contextUsage}
              offline={localAi.offline}
            />
            <InstallApp />
            <button
              type="button"
              className="icon-btn ghost"
              onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              title="Toggle theme"
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
        </header>
        {main}
      </div>
    </div>
  );
}
