import { useMemo } from "react";
import { ToolWorkspace } from "./ToolWorkspace.jsx";
import { buildPagePrompt, buildSelectionPrompt } from "../ai/prompts.js";
import { parseHash } from "../features/navigation.js";

function PageSourceHint({ fromExtension }) {
  if (fromExtension) {
    return (
      <section className="banner page-source-hint">
        <p>
          <strong>Loaded from another tab</strong> via the Local AI Chrome extension. Edit the text if you want,
          then run a mode below. Page content is treated as untrusted data, not instructions.
        </p>
      </section>
    );
  }

  return (
    <section className="banner page-source-hint">
      <p>
        <strong>What is this input?</strong> It holds the page text Local AI will work on. Modes like Summarize
        or Key points keep the same text and only change the task.
      </p>
      <p>
        <strong>Why is it empty?</strong> You are inside Local AI, so this app cannot see other Chrome tabs
        (browser security). It also does not scrape its own UI into the box.
      </p>
      <p>
        <strong>To use another open tab:</strong> install the Local AI extension from the{" "}
        <code>extension/</code> folder → open that other tab → click the extension →{" "}
        <em>Summarize page</em> (or Explain selection). That opens Local AI with that tab’s text filled in.
        You can also paste page text here manually.
      </p>
    </section>
  );
}

export function PageAiView({ provider, phase, prepareModel }) {
  const hash = parseHash();
  const initial = hash.params.get("payload") || "";
  const action = hash.params.get("action") || "summarize";
  const fromExtension = Boolean(initial.trim());

  const meta = useMemo(() => {
    if (!fromExtension) {
      return { title: "Pasted or unknown page", url: "", headings: [] };
    }
    const lines = initial.split("\n");
    const titleLine = lines.find((line) => /^Title:\s*/i.test(line.trim())) || "";
    const urlLine = lines.find((line) => /^URL:\s*/i.test(line.trim())) || "";
    const headingsIndex = lines.findIndex((line) => /^Headings:\s*$/i.test(line.trim()));
    const headings = [];
    if (headingsIndex >= 0) {
      for (let i = headingsIndex + 1; i < lines.length; i += 1) {
        const line = lines[i].trim();
        if (!line || /^(Title|URL|Selection):/i.test(line) || line.startsWith("[")) break;
        headings.push(line.slice(0, 160));
        if (headings.length >= 12) break;
      }
    }
    const fallbackTitle = lines.find((line) => line.trim()) || "";
    return {
      title:
        (titleLine.replace(/^Title:\s*/i, "").trim() || fallbackTitle.replace(/^Title:\s*/i, "").trim()).slice(
          0,
          120,
        ) || "Page from extension",
      url: urlLine.replace(/^URL:\s*/i, "").trim(),
      headings,
    };
  }, [fromExtension, initial]);

  return (
    <div className="page-tool">
      <PageSourceHint fromExtension={fromExtension} />
      <ToolWorkspace
        key={fromExtension ? `ext-${initial.slice(0, 40)}` : "page-empty"}
        title="Ask about this page"
        description="Work on page text you paste, or load another tab through the Local AI Chrome extension."
        modes={[
          { id: "summarize", label: "Summarize" },
          { id: "explain", label: "Explain" },
          { id: "keyPoints", label: "Key points" },
          { id: "numbers", label: "Numbers" },
          { id: "arguments", label: "Challenge" },
          { id: "notes", label: "Notes" },
          { id: "ask", label: "Ask" },
        ]}
        defaultMode={action}
        placeholder="Paste page text here, or use the Chrome extension on another tab…"
        initialInput={initial}
        provider={provider}
        phase={phase}
        prepareModel={prepareModel}
        buildPrompt={(text, mode) =>
          buildPagePrompt(mode, {
            title: meta.title,
            url: meta.url || "unknown",
            text,
            headings: meta.headings,
          })
        }
      />
    </div>
  );
}

export function ExplainView({ provider, phase, prepareModel }) {
  const hash = parseHash();
  const initial = hash.params.get("payload") || "";
  const fromExtension = Boolean(initial.trim());

  return (
    <div className="page-tool">
      <section className="banner page-source-hint">
        {fromExtension ? (
          <p>
            <strong>Selection loaded</strong> from the extension. Adjust it if needed, then pick an explain mode.
          </p>
        ) : (
          <p>
            <strong>Paste selected text</strong>, or on another tab use the Local AI extension →{" "}
            <em>Explain selection</em>. This screen cannot read other tabs by itself.
          </p>
        )}
      </section>
      <ToolWorkspace
        key={fromExtension ? `sel-${initial.slice(0, 40)}` : "selection-empty"}
        title="Explain selected text"
        description="The selected text is the primary context. The full page is not sent unless you paste it."
        modes={[
          { id: "explain", label: "Explain simply" },
          { id: "example", label: "With an example" },
          { id: "deeper", label: "Go deeper" },
          { id: "terms", label: "Technical terms" },
          { id: "context", label: "Context" },
          { id: "quiz", label: "Quiz me" },
          { id: "summarize", label: "Summarize" },
        ]}
        defaultMode="explain"
        placeholder="Paste the selected text…"
        initialInput={initial}
        provider={provider}
        phase={phase}
        prepareModel={prepareModel}
        buildPrompt={(text, mode) => buildSelectionPrompt(mode, text)}
      />
    </div>
  );
}
