import { useState } from "react";
import { CompatibilityPanel } from "./CompatibilityPanel.jsx";
import { capabilityLabel } from "../ai/capabilities.js";
import { downloadJson, exportAll, importAll } from "../storage/exportImport.js";
import { cleanupOrphanAttachments } from "../storage/attachments.js";
import { isAppShellCached } from "../pwa/shell.js";
import { analyticsConfigured, trackEvent } from "../analytics.js";

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
      title: offline ? "Download interrupted" : "Preparing Local AI",
      detail: offline
        ? "Reconnect to finish the one-time model download. Chat works offline after the model is ready."
        : "Chrome is downloading the on-device model.",
    };
  }
  if (phase === "checking") {
    return {
      title: "Checking Local AI",
      detail: "Detecting Prompt API support and model availability.",
    };
  }
  if (offline) {
    return {
      title: "Needs one online download",
      detail:
        "Chrome still needs to download the on-device model. Reconnect once, finish Prepare local AI, then chat works offline.",
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

function CheckRow({ label, ok, detail, tone }) {
  const resolved = tone || (ok ? "ok" : "bad");
  const value = detail || (ok ? "Yes" : "No");
  return (
    <div className={`status-check status-${resolved}`}>
      <span className="status-dot" aria-hidden="true" />
      <div>
        <strong>{label}</strong>
        <span>{value}</span>
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
  shellCached,
  contextUsage,
}) {
  const [offlineResult, setOfflineResult] = useState(null);
  const [cleanupCount, setCleanupCount] = useState(null);
  const diagnostics = provider.diagnostics || {};
  const overallTone = phaseTone(phase);
  const summary = phaseSummary(phase, offline);

  async function testOffline() {
    const shell = shellCached ?? isAppShellCached();
    const browserOnline = navigator.onLine;
    const checks = {
      shell,
      browserOnline,
      modelReady: phase === "ready",
      inference: false,
      message: "",
    };
    const cacheNote =
      "This visit is not served by the installed app cache. Open the production app once while online, then retry offline.";
    try {
      if (phase !== "ready") {
        checks.message = shell
          ? "Prepare local AI before testing inference."
          : `${cacheNote} Prepare local AI before testing inference.`;
      } else {
        const text = await provider.prompt("Reply with the single word: pong");
        checks.inference = /pong/i.test(text);
        if (!checks.inference) {
          checks.message = `The model responded, but not with the expected word. Response: ${text.slice(0, 80)}`;
        } else if (!shell) {
          checks.message = `Local inference succeeded. ${cacheNote}`;
        } else if (browserOnline) {
          checks.message =
            "Local inference succeeded. The browser still reports a network connection, so this does not prove the machine is offline.";
        } else {
          checks.message =
            "Local AI responded while the browser reported no network and the app shell was cached.";
        }
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
        {analyticsConfigured() ? (
          <p>
            Usage: Google Analytics receives which page and feature you use. Prompts, replies, notes,
            and files stay on this device.
          </p>
        ) : null}
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
            shellCached
              ? phase === "ready"
                ? "App cached · model ready"
                : "App cached · model not ready"
              : "App not cached"
          }
          tone={shellCached && phase === "ready" ? "ok" : "warn"}
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
            try {
              downloadJson(`local-ai-backup-${Date.now()}.json`, await exportAll());
              trackEvent("data_export", { status: "success" });
            } catch {
              trackEvent("data_export", { status: "error" });
            }
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
              event.target.value = "";
              if (!file) return;
              try {
                await importAll(JSON.parse(await file.text()));
                trackEvent("data_import", { status: "success" });
              } catch {
                trackEvent("data_import", { status: "error" });
              }
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
        <section className={`status-test status-${offlineResult.inference ? "ok" : "warn"}`}>
          <h3>Offline test</h3>
          <div className="status-check-list">
            <CheckRow label="App shell cached" ok={offlineResult.shell} detail={offlineResult.shell ? "Yes" : "No"} />
            <CheckRow label="Local prompt succeeded" ok={offlineResult.inference} detail={offlineResult.inference ? "Yes" : "No"} />
            <CheckRow
              label="Browser reports a network connection"
              tone="muted"
              detail={offlineResult.browserOnline ? "Yes" : "No"}
            />
          </div>
          <p className="status-test-message">{offlineResult.message}</p>
        </section>
      ) : null}

      {phase === "unsupported" || phase === "unavailable" ? <CompatibilityPanel phase={phase} /> : null}
    </div>
  );
}
