import { useState } from "react";
import { categorizeError } from "../ai/errors.js";
import { createNote, deriveNoteTitle } from "../storage/notes.js";
import { RichInput, RichResult } from "./RichDoc.jsx";

export function ToolWorkspace({
  title,
  description,
  modes = [],
  defaultMode,
  placeholder,
  provider,
  phase,
  prepareModel,
  buildPrompt,
  initialInput = "",
  extraActions,
}) {
  const [input, setInput] = useState(initialInput);
  const [mode, setMode] = useState(defaultMode || modes[0]?.id || "");
  const [output, setOutput] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!input.trim() || phase !== "ready") return;
    setBusy(true);
    setError(null);
    setOutput("");
    try {
      await provider.createSession();
      const prompt = buildPrompt(input, mode);
      await provider.streamEphemeral(prompt, setOutput);
    } catch (caught) {
      setError(categorizeError(caught) || "Couldn't run that locally.");
    } finally {
      setBusy(false);
    }
  }

  const modeLabel = modes.find((item) => item.id === mode)?.label;

  return (
    <div className="panel-page tool-workspace">
      <header className="panel-intro">
        <p className="lede">{description}</p>
      </header>

      {phase !== "ready" ? (
        <section className="banner">
          <p>Local AI isn&apos;t ready yet. Prepare the on-device model first.</p>
          <button type="button" className="prepare-btn" onClick={prepareModel}>
            Prepare local AI
          </button>
        </section>
      ) : null}

      {modes.length ? (
        <div className="mode-row" role="group" aria-label="Output mode">
          {modes.map((item) => (
            <button
              key={item.id}
              type="button"
              className={mode === item.id ? "chip-btn active" : "chip-btn"}
              onClick={() => setMode(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

      <section className="tool-compose">
        <RichInput
          value={input}
          onChange={setInput}
          placeholder={placeholder}
          label="Input"
          aria-label={title}
          disabled={busy}
        />
        <div className="panel-actions">
          <div className="panel-actions-secondary">
            {output ? (
              <button
                type="button"
                className="text-btn"
                onClick={() =>
                  createNote({
                    title: deriveNoteTitle(output),
                    content: output,
                    sourceType: "manual",
                  })
                }
              >
                Save as note
              </button>
            ) : null}
            {extraActions}
          </div>
          <button
            type="button"
            className="prepare-btn panel-actions-primary"
            disabled={busy || phase !== "ready"}
            onClick={run}
          >
            {busy ? "Working…" : "Run locally"}
          </button>
        </div>
      </section>

      <section className="tool-thread" aria-live="polite">
        {output || busy ? (
          <div className="tool-turn">
            {modeLabel ? <p className="tool-turn-meta">{modeLabel}</p> : null}
            <RichResult value={output} onChange={setOutput} busy={busy} />
          </div>
        ) : (
          <p className="tool-empty muted">Run locally to see a result here.</p>
        )}
      </section>

      {error ? <p className="error-banner">{error}</p> : null}
    </div>
  );
}
