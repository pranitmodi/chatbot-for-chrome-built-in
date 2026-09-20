import { CompatibilityPanel } from "./CompatibilityPanel.jsx";
import { useInstallPrompt } from "./InstallApp.jsx";
import {
  environmentReady,
  modelReady,
  onboardingStage,
} from "../features/onboarding.js";

function Step({ index, title, detail, state }) {
  return (
    <li className={`onboard-step is-${state}`}>
      <span className="onboard-index" aria-hidden="true">
        {state === "done" ? "✓" : index}
      </span>
      <div>
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
    </li>
  );
}

function stepState(stage, id, { blocked, prepared }) {
  if (id === "environment") {
    if (blocked) return "current";
    if (stage === "checking") return "current";
    return "done";
  }
  if (id === "prepare") {
    if (blocked || stage === "checking") return "pending";
    if (prepared) return "done";
    return "current";
  }
  if (blocked || !prepared) return "pending";
  return "current";
}

export function OnboardingWizard({
  phase,
  downloadProgress,
  error,
  prepareModel,
  onOpenStatus,
  onComplete,
}) {
  const stage = onboardingStage(phase);
  const blocked = phase === "unsupported" || phase === "unavailable";
  const prepared = modelReady(phase);
  const envOk = environmentReady(phase);
  const { installed, installEvent, install } = useInstallPrompt();
  const percent =
    downloadProgress == null ? null : Math.min(100, Math.max(0, Math.round(downloadProgress * 100)));

  function environmentDetail() {
    if (phase === "checking") return "Detecting Chrome’s Prompt API on this device.";
    if (phase === "unsupported") return "This browser does not expose LanguageModel. Open desktop Google Chrome.";
    if (phase === "unavailable") {
      return "Chrome is here, but this machine cannot host the on-device model yet.";
    }
    return "Prompt API is present. Next, prepare the on-device model once.";
  }

  function prepareDetail() {
    if (blocked) return "Available after this Chrome can host the on-device model.";
    if (phase === "downloading") {
      return percent == null
        ? "Chrome is downloading the on-device model. Keep this tab open."
        : `Chrome is downloading the on-device model… ${percent}%`;
    }
    if (phase === "error") {
      return error || "Chrome could not prepare the local model. Try again on an unmetered network.";
    }
    if (prepared) return "The on-device model is ready for chat and tools.";
    return "A click is required before Chrome can download Gemini Nano. This is not the chat UI cache.";
  }

  function installDetail() {
    if (blocked) return "Optional. Install caches the UI only after Local AI can run here.";
    if (installed) {
      return "This window is already running as an installed app. The model still lives in Chrome, not in the install bundle.";
    }
    return "Install caches this UI for offline use. The language model is downloaded by Chrome separately.";
  }

  return (
    <div className="onboard panel-page">
      <header className="home-hero">
        <p className="eyebrow">First-run setup</p>
        <h2>Get Local AI ready on this device</h2>
        <p>
          Inference uses Chrome’s on-device Prompt API. There is no account and no API key. After the
          model is prepared, chat can work without the internet.
        </p>
      </header>

      <ol className="onboard-steps">
        <Step
          index={1}
          title="Check Chrome"
          detail={environmentDetail()}
          state={stepState(stage, "environment", { blocked, prepared })}
        />
        <Step
          index={2}
          title="Prepare local AI"
          detail={prepareDetail()}
          state={stepState(stage, "prepare", { blocked, prepared })}
        />
        <Step
          index={3}
          title="Install for offline UI"
          detail={installDetail()}
          state={stepState(stage, "install", { blocked, prepared })}
        />
      </ol>

      {blocked ? (
        <>
          <CompatibilityPanel phase={phase} compact />
          <button type="button" className="text-btn" onClick={onOpenStatus}>
            Open status for full diagnostics
          </button>
        </>
      ) : null}

      {stage === "checking" ? <p className="muted">Checking local AI…</p> : null}

      {stage === "prepare" && phase !== "downloading" ? (
        <div className="onboard-actions">
          <button type="button" className="prepare-btn" onClick={prepareModel}>
            Prepare local AI
          </button>
        </div>
      ) : null}

      {phase === "downloading" ? (
        <div
          className="onboard-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent ?? undefined}
          aria-label="Preparing local AI"
        >
          <span style={{ width: `${percent ?? 8}%` }} />
        </div>
      ) : null}

      {stage === "install" ? (
        <div className="onboard-actions">
          {installEvent && !installed ? (
            <button type="button" className="prepare-btn" onClick={install}>
              Install app
            </button>
          ) : null}
          <button type="button" className="prepare-btn" onClick={onComplete}>
            Start chatting
          </button>
          {!installed && !installEvent ? (
            <p className="muted">
              If Chrome does not offer Install yet, use the install icon in the address bar after this
              site is served over HTTPS. You can skip this and still chat while online.
            </p>
          ) : null}
        </div>
      ) : null}

      {envOk && !prepared && stage === "prepare" ? (
        <p className="muted">
          Installing the app caches the interface only. You still need Prepare local AI for the model.
        </p>
      ) : null}
    </div>
  );
}
