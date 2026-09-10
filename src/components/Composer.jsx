import { useEffect, useRef, useState } from "react";
import { AttachmentPreview } from "./AttachmentPreview.jsx";
import { CameraCapture } from "./CameraCapture.jsx";
import {
  CameraIcon,
  ComposerToolButton,
  MicIcon,
  PlusIcon,
} from "./ComposerToolButton.jsx";

function pickRecorderMimeType() {
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  return types.find((type) => window.MediaRecorder?.isTypeSupported?.(type)) ?? "";
}

export function Composer({
  value,
  onChange,
  attachments,
  onRemoveAttachment,
  onPickFiles,
  onCameraCapture,
  cameraOpen,
  onCameraOpen,
  onCameraClose,
  onMicrophoneCapture,
  onToolError,
  disabled,
  generating,
  capabilities,
  fileError,
  onSend,
  onStop,
  dragActive,
}) {
  const fileRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const cancelledRef = useRef(false);
  const [recording, setRecording] = useState(false);
  const canAttach = capabilities.image || capabilities.audio || capabilities.videoFrames;
  const canSend = !disabled && (value.trim() || attachments.length) && !generating;
  const canRecord =
    !disabled &&
    !generating &&
    capabilities.audio &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    Boolean(window.MediaRecorder);

  function onKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canSend) onSend();
    }
  }

  function acceptAttribute() {
    const parts = [];
    if (capabilities.image) parts.push("image/png", "image/jpeg", "image/webp");
    if (capabilities.audio) parts.push("audio/*");
    if (capabilities.videoFrames) parts.push("video/mp4", "video/webm", "video/quicktime");
    return parts.join(",");
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function finishRecording(keepClip) {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    stopStream();
    setRecording(false);
    if (!keepClip) {
      chunksRef.current = [];
    }
  }

  async function toggleMicrophone() {
    if (recording) {
      finishRecording(true);
      return;
    }
    if (!canRecord) {
      onToolError?.(
        capabilities.audio
          ? "Microphone recording isn't available in this browser."
          : "Audio analysis isn't available in this Chrome configuration.",
      );
      return;
    }

    onToolError?.(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (cancelledRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = pickRecorderMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stopStream();
        const chunks = chunksRef.current;
        chunksRef.current = [];
        recorderRef.current = null;
        if (cancelledRef.current || !chunks.length) return;
        const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || "audio/webm" });
        onMicrophoneCapture(blob);
        setRecording(false);
      };
      recorder.start();
      setRecording(true);
    } catch {
      stopStream();
      setRecording(false);
      onToolError?.("Microphone permission is needed to record audio.");
    }
  }

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
      const recorder = recorderRef.current;
      recorderRef.current = null;
      if (recorder && recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch {
          // Already stopped.
        }
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      chunksRef.current = [];
    };
  }, []);

  return (
    <div className="composer-wrap">
      <form
        className={`composer ${dragActive ? "dragover" : ""}`}
        onSubmit={(event) => {
          event.preventDefault();
          if (recording) return;
          if (generating) onStop();
          else if (canSend) onSend();
        }}
      >
        <AttachmentPreview attachments={attachments} onRemove={onRemoveAttachment} />
        {fileError ? <p className="error-banner" style={{ margin: "0 8px 8px" }}>{fileError}</p> : null}
        {recording ? (
          <p className="record-hint">Recording… tap the microphone to stop and attach.</p>
        ) : null}
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          onPaste={(event) => {
            const files = [...(event.clipboardData?.files || [])];
            if (files.length) {
              event.preventDefault();
              onPickFiles(files);
            }
          }}
          placeholder={disabled ? "Local AI is not ready yet" : "Message Built-in Chat"}
          disabled={disabled || generating || recording}
          rows={2}
          aria-label="Message"
        />
        <div className="composer-footer">
          <div className="composer-tools">
            <input
              ref={fileRef}
              className="hidden-input"
              type="file"
              accept={acceptAttribute()}
              multiple
              onChange={(event) => {
                onPickFiles(event.target.files);
                event.target.value = "";
              }}
            />
            <ComposerToolButton
              label="Attach a file"
              title={canAttach ? "Attach a file" : "Attachments are not available"}
              disabled={disabled || generating || recording || !canAttach}
              onClick={() => fileRef.current?.click()}
            >
              <PlusIcon />
            </ComposerToolButton>
            <ComposerToolButton
              label="Capture from camera"
              title="Capture from camera"
              disabled={
                disabled ||
                generating ||
                recording ||
                !capabilities.image ||
                !navigator.mediaDevices?.getUserMedia
              }
              onClick={onCameraOpen}
            >
              <CameraIcon />
            </ComposerToolButton>
            <ComposerToolButton
              label={recording ? "Stop recording" : "Record audio"}
              title={
                canRecord || recording
                  ? recording
                    ? "Stop recording"
                    : "Record with microphone"
                  : "Audio analysis isn't available in this Chrome configuration."
              }
              disabled={disabled || generating || (!canRecord && !recording)}
              pressed={recording}
              onClick={toggleMicrophone}
            >
              <MicIcon />
            </ComposerToolButton>
          </div>
          {generating ? (
            <button type="submit" className="send-btn stop">
              Stop
            </button>
          ) : (
            <button type="submit" className="send-btn" disabled={!canSend || recording}>
              Send
            </button>
          )}
        </div>
      </form>
      <p className="privacy">This app doesn't send your prompts to our AI server. Chrome may still download the on-device model.</p>
      <CameraCapture open={cameraOpen} onClose={onCameraClose} onCapture={onCameraCapture} />
    </div>
  );
}
