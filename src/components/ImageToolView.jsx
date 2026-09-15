import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus } from "lucide-react";
import {
  MAX_ATTACHMENTS,
  prepareFiles,
  prepareCameraCapture,
  attachmentToMediaParts,
} from "../ai/multimodal.js";
import { buildImagePrompt } from "../ai/prompts.js";
import { buildPromptInput } from "../ai/provider.js";
import { categorizeError } from "../ai/errors.js";
import { createNote } from "../storage/notes.js";
import { deriveNoteTitle } from "../storage/notes.js";
import { AttachmentPreview } from "./AttachmentPreview.jsx";
import { CameraCapture } from "./CameraCapture.jsx";
import { RichResult } from "./RichDoc.jsx";

const ACTIONS = [
  { id: "describe", label: "Describe" },
  { id: "text", label: "Extract text" },
  { id: "screenshot", label: "Explain screenshot" },
  { id: "chart", label: "Analyze chart" },
  { id: "ui", label: "Explain UI" },
  { id: "error", label: "Find the problem" },
  { id: "notes", label: "Turn into notes" },
  { id: "ask", label: "Ask" },
];

export function ImageToolView({ provider, phase, prepareModel, capabilities }) {
  const fileRef = useRef(null);
  const [attachments, setAttachments] = useState([]);
  const [action, setAction] = useState("describe");
  const [question, setQuestion] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => () => {}, []);

  if (!capabilities.image) {
    return (
      <div className="panel-page tool-workspace">
        <h2>Analyze image</h2>
        <p className="lede">Image input isn&apos;t available in this Chrome configuration.</p>
      </div>
    );
  }

  async function onPickFiles(fileList) {
    try {
      const prepared = await prepareFiles(fileList, capabilities);
      setAttachments(prepared.slice(0, MAX_ATTACHMENTS));
      setError(null);
    } catch (caught) {
      setError(caught.message);
    }
  }

  async function run() {
    if (!attachments.length) {
      setError("Attach an image first. Nothing was attached, so the model has nothing to look at.");
      return;
    }
    setBusy(true);
    setError(null);
    setOutput("");
    try {
      await provider.createSession();
      const media = attachments.flatMap(attachmentToMediaParts);
      const prompt = buildPromptInput(buildImagePrompt(action, question), media);
      await provider.streamEphemeral(prompt, setOutput);
    } catch (caught) {
      setError(categorizeError(caught) || "Couldn't analyze that image.");
    } finally {
      setBusy(false);
    }
  }

  const canCamera = Boolean(navigator.mediaDevices?.getUserMedia);

  return (
    <div className="panel-page tool-workspace">
      <header className="panel-intro">
        <p className="lede">Images stay in the browser. Local AI will not invent a picture if none is attached.</p>
      </header>

      {phase !== "ready" ? (
        <section className="banner">
          <p>Local AI isn&apos;t ready yet. Prepare the on-device model first.</p>
          <button type="button" className="prepare-btn" onClick={prepareModel}>
            Prepare local AI
          </button>
        </section>
      ) : null}

      <div className="mode-row" role="group" aria-label="Image action">
        {ACTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={action === item.id ? "chip-btn active" : "chip-btn"}
            onClick={() => setAction(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <section className="media-picker">
        <input
          ref={fileRef}
          className="hidden-input"
          type="file"
          accept="image/png,image/jpeg,image/webp,video/mp4,video/webm"
          onChange={async (event) => {
            await onPickFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <button type="button" className="media-action" onClick={() => fileRef.current?.click()}>
          <span className="media-action-icon" aria-hidden="true">
            <ImagePlus size={22} strokeWidth={1.75} />
          </span>
          <span className="media-action-copy">
            <strong>Choose file</strong>
            <small>PNG, JPEG, WebP, or short video</small>
          </span>
        </button>
        <button
          type="button"
          className="media-action"
          disabled={!canCamera}
          onClick={() => setCameraOpen(true)}
          title={canCamera ? "Open camera" : "Camera is not available"}
        >
          <span className="media-action-icon" aria-hidden="true">
            <Camera size={22} strokeWidth={1.75} />
          </span>
          <span className="media-action-copy">
            <strong>Open camera</strong>
            <small>{canCamera ? "Capture a snapshot" : "Not available here"}</small>
          </span>
        </button>
      </section>

      <AttachmentPreview
        attachments={attachments}
        onRemove={(id) => setAttachments((current) => current.filter((item) => item.id !== id))}
      />

      {action === "ask" ? (
        <textarea
          className="panel-input"
          rows={3}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask a question about the image"
        />
      ) : null}

      <div className="panel-actions">
        <div className="panel-actions-secondary">
          {output ? (
            <button
              type="button"
              className="text-btn"
              onClick={() => createNote({ title: deriveNoteTitle(output), content: output, sourceType: "image" })}
            >
              Save as note
            </button>
          ) : null}
        </div>
        <button
          type="button"
          className="prepare-btn panel-actions-primary"
          disabled={busy || phase !== "ready"}
          onClick={run}
        >
          {busy ? "Working…" : "Analyze locally"}
        </button>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}

      {output || busy ? (
        <section className="tool-thread">
          <div className="tool-turn">
            <RichResult value={output} onChange={setOutput} busy={busy} />
          </div>
        </section>
      ) : null}

      <CameraCapture
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={async (blob) => {
          setCameraOpen(false);
          const attachment = await prepareCameraCapture(blob);
          setAttachments((current) => [...current, attachment].slice(0, MAX_ATTACHMENTS));
        }}
      />
    </div>
  );
}
