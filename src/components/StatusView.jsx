import { useState } from "react";
import { CompatibilityPanel } from "./CompatibilityPanel.jsx";
import { capabilityLabel } from "../ai/capabilities.js";
import { downloadJson, exportAll, importAll } from "../storage/exportImport.js";
import { cleanupOrphanAttachments } from "../storage/attachments.js";

function phaseTone(phase) {
  if (phase === "ready") return "ok";
  if (phase === "unsupported" || phase === "unavailable") return "bad";
  if (phase === "downloading" || phase === "checking") return "warn";
  return "warn";
}

function phaseSummary(phase, offline) {
  if (phase === "ready") {
    return {
      title: offline ? "Ready · offline-capable" : "Local AI is ready",
      detail: offline
        ? "The on-device model is prepared. Inference does not need the network."
        : "The on-device model is prepared and available for chat and tools.",
    };
  }
  if (phase === "unsupported") {
    return {
      title: "Not available",
      detail: "This browser does not expose Chrome’s Prompt API.",
    };
  }
  if (phase === "unavailable") {
    return {
      title: "Unavailable here",
      detail: "Chrome is present, but Local AI cannot run in this configuration.",
    };
  }
  if (phase === "downloading") {
    return {
      title: "Preparing Local AI",
      detail: "Chrome is downloading the on-device model.",
    };
  }
  if (phase === "checking") {
    return {
      title: "Checking Local AI",
      detail: "Detecting Prompt API support and model availability.",
    };
  }
  return {
    title: "Local AI not prepared",
    detail: "Prepare the on-device model once before chatting or running tools.",
  };
}

function capabilityTone(capabilities, key, { required = false } = {}) {
  if (!capabilities) return "muted";
  if (capabilities[key]) return "ok";
  return required ? "bad" : "warn";
}

function StatusItem({ label, value, tone }) {
  return (
    <div className={`status-item status-${tone}`}>
      <dt>{label}</dt>
      <dd>
        <span className="status-pill">
          <span className="status-dot" aria-hidden="true" />
          <span>{value}</span>
        </span>
      </dd>
    </div>
  );
}

function CheckRow({ label, ok, detail }) {
  const tone = ok ? "ok" : "bad";
  return (
    <div className={`status-check status-${tone}`}>
      <span className="status-dot" aria-hidden="true" />
      <div>
        <strong>{label}</strong>
        <span>{ok ? "Yes" : "No"}{detail ? ` · ${detail}` : ""}</span>
      </div>
    </div>
  );
}

export function StatusView({
  phase,
  capabilities,
  provider,
  prepareModel,
  offline,
  contextUsage,
}) {
  const [offlineResult, setOfflineResult] = useState(null);
  const [cleanupCount, setCleanupCount] = useState(null);
  const diagnostics = provider.diagnostics || {};
  const overallTone = phaseTone(phase);
  const summary = phaseSummary(phase, offline);

  async function testOffline() {
    const checks = {
      shell: true,
      online: navigator.onLine,
      modelReady: phase === "ready",
      textInput: Boolean(capabilities.textInput || capabilities.localModel),
      inference: false,
      message: "",
    };
    try {
      if (phase !== "ready") {
        checks.message = "Prepare local AI before testing inference.";
      } else {
        const text = await provider.prompt("Reply with the single word: pong");
        checks.inference = /pong/i.test(text);
        checks.message = checks.inference
          ? "Local AI successfully generated a response. This test does not require the network for inference; your browser may still be online."
          : `The model responded, but not with the expected word. Response: ${text.slice(0, 80)}`;
      }
    } catch (error) {
      checks.message = error.message || "Local inference failed.";
    }
    setOfflineResult(checks);
  }

  const metric = (value) => (value == null ? "N/A" : String(value));

  return (
    <div className="panel-page">
      <header className="panel-intro">
        <p className="lede">Health of Chrome’s on-device model, capabilities, and offline readiness.</p>
      </header>

      <section className={`status-hero status-${overallTone}`} aria-live="polite">
        <span className="status-dot" aria-hidden="true" />
        <div>
          <strong>{summary.title}</strong>
          <p>{summary.detail}</p>
        </div>
      </section>

      <section className="privacy-card">
        <h3>Privacy</h3>
        <p>Model: Gemini Nano (Chrome on-device) when Local AI is active</p>
        <p>Inference: On device</p>
        <p>Network: {offline ? "Offline" : "This browser may be online"}</p>
        <p>Account: Not required</p>
        <p>
          Your prompts are processed using the local AI available in Chrome. The app does not need a
          cloud AI API for Local AI inference.
        </p>
      </section>

      <dl className="status-grid">
        <StatusItem
          label="Chrome Prompt API"
          value={phase === "unsupported" ? "Not present" : "Present"}
          tone={phase === "unsupported" ? "bad" : "ok"}
        />
        <StatusItem label="Availability" value={phase} tone={overallTone} />
        <StatusItem
          label="Text"
          value={capabilityLabel(capabilities, "textInput")}
          tone={capabilityTone(capabilities, "textInput", { required: true })}
        />
        <StatusItem
          label="Image"
          value={capabilityLabel(capabilities, "image")}
          tone={capabilityTone(capabilities, "image")}
        />
        <StatusItem
          label="Audio"
          value={capabilityLabel(capabilities, "audio")}
          tone={capabilityTone(capabilities, "audio")}
        />
        <StatusItem
          label="Streaming"
          value={capabilityLabel(capabilities, "streaming")}
          tone={capabilityTone(capabilities, "streaming", { required: true })}
        />
        <StatusItem
          label="Summarizer API"
          value={capabilityLabel(capabilities, "summarization")}
          tone={capabilityTone(capabilities, "summarization")}
        />
        <StatusItem
          label="Rewriter API"
          value={capabilityLabel(capabilities, "rewriting")}
          tone={capabilityTone(capabilities, "rewriting")}
        />
        <StatusItem
          label="Proofreader API"
          value={capabilityLabel(capabilities, "proofreading")}
          tone={capabilityTone(capabilities, "proofreading")}
        />
        <StatusItem
          label="Offline readiness"
          value={
            phase === "ready"
              ? "UI cacheable · model ready"
              : "UI cacheable · model not ready"
          }
          tone={phase === "ready" ? "ok" : "warn"}
        />
        <StatusItem
          label="Context"
          value={contextUsage?.window ? `${contextUsage.usage}/${contextUsage.window}` : "N/A"}
          tone={contextUsage?.window ? "ok" : "muted"}
        />
        <StatusItem
          label="Session create"
          value={`${metric(diagnostics.sessionCreateMs)} ms`}
          tone={diagnostics.sessionCreateMs == null ? "muted" : "ok"}
        />
        <StatusItem
          label="Time to first token"
          value={`${metric(diagnostics.timeToFirstTokenMs)} ms`}
          tone={diagnostics.timeToFirstTokenMs == null ? "muted" : "ok"}
        />
        <StatusItem
          label="Generation duration"
          value={`${metric(diagnostics.generationMs)} ms`}
          tone={diagnostics.generationMs == null ? "muted" : "ok"}
        />
      </dl>

      <div className="panel-actions">
        <button type="button" className="prepare-btn" onClick={prepareModel}>
          Prepare local AI
        </button>
        <button type="button" className="text-btn" onClick={testOffline}>
          Test Offline Mode
        </button>
        <button
          type="button"
          className="text-btn"
          onClick={async () => {
            downloadJson(`local-ai-backup-${Date.now()}.json`, await exportAll());
          }}
        >
          Export all
        </button>
        <label className="text-btn">
          Import
          <input
            className="hidden-input"
            type="file"
            accept="application/json"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              await importAll(JSON.parse(await file.text()));
              event.target.value = "";
            }}
          />
        </label>
        <button
          type="button"
          className="text-btn"
          onClick={async () => setCleanupCount(await cleanupOrphanAttachments())}
        >
          Clean leftover attachments
        </button>
      </div>

      {cleanupCount != null ? <p className="muted">{cleanupCount} orphaned attachment(s) removed.</p> : null}

      {offlineResult ? (
        <section className={`status-test status-${offlineResult.inference || (offlineResult.modelReady && offlineResult.textInput) ? (offlineResult.inference ? "ok" : "warn") : "bad"}`}>
          <h3>Offline test</h3>
          <div className="status-check-list">
            <CheckRow label="Application shell" ok={offlineResult.shell} />
            <CheckRow
              label="Browser reports online"
              ok={offlineResult.online}
              detail={offlineResult.online ? "network may still be up" : "offline"}
            />
            <CheckRow label="Local model available" ok={offlineResult.modelReady} />
            <CheckRow label="Text input available" ok={offlineResult.textInput} />
            <CheckRow label="Local inference succeeded" ok={offlineResult.inference} />
          </div>
          <p className="status-test-message">{offlineResult.message}</p>
        </section>
      ) : null}

      {phase === "unsupported" || phase === "unavailable" ? <CompatibilityPanel phase={phase} /> : null}
    </div>
  );
}
