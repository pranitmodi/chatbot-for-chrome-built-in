import { useEffect, useRef, useState } from "react";
import { categorizeError } from "../ai/errors.js";
import { createNote, deriveNoteTitle } from "../storage/notes.js";
import { RichInput, RichResult } from "./RichDoc.jsx";
import { handoffHasRun, markHandoffRun } from "../features/navigation.js";
import { openDraft } from "../features/drafts.js";

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
  autoRun = false,
  handoffId,
  sourceLabel,
}) {
  const [input, setInput] = useState(initialInput);
  const [mode, setMode] = useState(defaultMode || modes[0]?.id || "");
  const [output, setOutput] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef(null);

  async function run() {
    if (!input.trim() || phase !== "ready") return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError(null);
    setOutput("");
    try {
      await provider.createSession();
      const prompt = buildPrompt(input, mode);
      await provider.streamEphemeral(prompt, setOutput, controller.signal);
    } catch (caught) {
      if (caught?.name !== "AbortError") {
        setError(categorizeError(caught) || "Couldn't run that locally.");
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!autoRun || !handoffId || phase !== "ready" || !input.trim() || handoffHasRun(handoffId)) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      if (handoffHasRun(handoffId)) return;
      markHandoffRun(handoffId);
      run();
    }, 0);
    return () => window.clearTimeout(timer);
    // Run only when a pending handoff becomes ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun, handoffId, phase]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  const modeLabel = modes.find((item) => item.id === mode)?.label;

  return (
    <div className="panel-page tool-workspace">
      <header className="panel-intro">
        <p className="lede">{description}</p>
        {sourceLabel ? <p className="source-label">Source · {sourceLabel}</p> : null}
      </header>

      {phase !== "ready" ? (
        <section className="banner">
          <p>Local AI isn&apos;t ready yet. Prepare the on-device model first.</p>
          <button type="button" className="prepare-btn" onClick={prepareModel}>
            Prepare local AI
          </button>
        </section>
      ) : null}

      <div className="tool-flow">
        <section className="tool-compose">
          <div className="tool-card-heading">
            <div>
              <span className="eyebrow">Input</span>
              <strong>{sourceLabel || "Your source material"}</strong>
            </div>
            <span className="character-count">{input.length.toLocaleString()} characters</span>
          </div>
          <RichInput
            value={input}
            onChange={setInput}
            placeholder={placeholder}
            label="Source"
            aria-label={title}
            disabled={busy}
            onClear={() => setInput("")}
          />
          {modes.length ? (
            <div className="mode-row" role="group" aria-label="Output mode">
              {modes.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={mode === item.id ? "chip-btn active" : "chip-btn"}
                  onClick={() => setMode(item.id)}
                  disabled={busy}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}
          <div className="panel-actions">
            <div className="panel-actions-secondary">{extraActions}</div>
            {busy ? (
              <button type="button" className="prepare-btn stop-action" onClick={() => abortRef.current?.abort()}>
                Stop
              </button>
            ) : (
              <button
                type="button"
                className="prepare-btn panel-actions-primary"
                disabled={!input.trim() || phase !== "ready"}
                onClick={run}
              >
                {output ? "Regenerate" : "Run locally"}
              </button>
            )}
          </div>
        </section>

        <section className="tool-thread" aria-live="polite">
          <div className="tool-card-heading">
            <div>
              <span className="eyebrow">Output</span>
              <strong>{modeLabel || "Local result"}</strong>
            </div>
            {output ? <span className="character-count">{output.length.toLocaleString()} characters</span> : null}
          </div>
          <RichResult
            value={output}
            onChange={setOutput}
            busy={busy}
            actions={
              output ? (
                <>
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
                    Save note
                  </button>
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() =>
                      openDraft("chat", `Continue from this local result:\n\n${output}`, title)
                    }
                  >
                    Continue in Chat
                  </button>
                  <label className="action-select-label">
                    <span className="sr-only">Use result in another tool</span>
                    <select
                      className="action-select"
                      defaultValue=""
                      onChange={(event) => {
                        if (!event.target.value) return;
                        openDraft(event.target.value, output, title);
                      }}
                    >
                      <option value="" disabled>Use in…</option>
                      <option value="summarize">Summarize</option>
                      <option value="rewrite">Rewrite</option>
                      <option value="study">Study</option>
                      <option value="extract">Extract</option>
                    </select>
                  </label>
                </>
              ) : null
            }
          />
        </section>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}
    </div>
  );
}
