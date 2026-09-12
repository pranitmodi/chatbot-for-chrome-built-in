import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChromeLocalProvider, buildPromptInput, categorizeError } from "../ai/chromeLocal.js";
import { AVAILABILITY } from "../ai/types.js";
import {
  MAX_ATTACHMENTS,
  attachmentToMediaParts,
  prepareCameraCapture,
  prepareFiles,
  prepareMicrophoneCapture,
  revokeAll,
  revokeAttachment,
} from "../ai/multimodal.js";
import { CompatibilityPanel } from "./CompatibilityPanel.jsx";
import { Composer } from "./Composer.jsx";
import { InstallApp } from "./InstallApp.jsx";
import { Message } from "./Message.jsx";
import { ModelStatus } from "./ModelStatus.jsx";

const STARTERS = [
  { label: "Text", text: "Explain recursion like I'm 12." },
  { label: "Image", text: "What's in this image?", needsImage: true },
  { label: "Screenshot", text: "Look at this screenshot and explain what is wrong with the UI.", needsImage: true },
  { label: "Photo", text: "Summarize the important information in this photo.", needsImage: true },
  { label: "Creative", text: "Turn this idea into a short story." },
  { label: "Coding", text: "Explain this code and suggest a simpler implementation." },
];

function hasVisualAttachment(list) {
  return list.some((item) => item.kind === "image" || item.kind === "video");
}

function promptNeedsImage(text) {
  return /\b(this image|this screenshot|this photo|this picture|in this image|this menu)\b/i.test(
    text,
  );
}

export function Chat({ theme, onToggleTheme }) {
  const providerRef = useRef(null);
  if (!providerRef.current) {
    providerRef.current = new ChromeLocalProvider();
  }
  const provider = providerRef.current;

  const [phase, setPhase] = useState("checking");
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [capabilities, setCapabilities] = useState({
    image: false,
    audio: false,
    videoFrames: false,
  });
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [contextNotice, setContextNotice] = useState(false);
  const [contextUsage, setContextUsage] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const abortRef = useRef(null);
  const transcriptRef = useRef(null);
  const bottomSentinelRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const autoScrollingRef = useRef(false);
  const dragDepth = useRef(0);

  function isNearBottom(element) {
    return element.scrollHeight - element.scrollTop - element.clientHeight <= 48;
  }

  function unpinFromBottom() {
    stickToBottomRef.current = false;
  }

  function scrollTranscriptToBottom() {
    const element = transcriptRef.current;
    if (!element || !stickToBottomRef.current) return;
    autoScrollingRef.current = true;
    element.scrollTop = element.scrollHeight;
    requestAnimationFrame(() => {
      autoScrollingRef.current = false;
    });
  }

  function onTranscriptScroll() {
    if (autoScrollingRef.current) return;
    const element = transcriptRef.current;
    if (!element) return;
    if (!isNearBottom(element)) {
      stickToBottomRef.current = false;
    }
  }

  function onTranscriptWheel(event) {
    if (event.deltaY < 0) unpinFromBottom();
  }

  useEffect(() => {
    provider.onContextOverflow = () => setContextNotice(true);
    let cancelled = false;

    (async () => {
      try {
        const result = await provider.checkAvailability();
        if (cancelled) return;
        setCapabilities(result.capabilities);

        if (result.status === AVAILABILITY.UNSUPPORTED) {
          setPhase("unsupported");
          return;
        }
        if (result.status === AVAILABILITY.UNAVAILABLE) {
          setPhase("unavailable");
          return;
        }
        if (result.status === AVAILABILITY.AVAILABLE) {
          try {
            await provider.initialize();
            if (cancelled) return;
            setContextUsage(provider.getContextUsage());
            setPhase("ready");
            return;
          } catch {
            if (cancelled) return;
            setPhase("downloadable");
            return;
          }
        }
        if (result.status === AVAILABILITY.DOWNLOADING) {
          setPhase("downloading");
          return;
        }
        setPhase("downloadable");
      } catch {
        if (!cancelled) {
          setPhase("unsupported");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [provider]);

  useEffect(() => {
    const onPageHide = () => {
      abortRef.current?.abort();
      provider.destroy();
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [provider]);

  useEffect(() => {
    const root = transcriptRef.current;
    const sentinel = bottomSentinelRef.current;
    if (!root || !sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (autoScrollingRef.current) {
          stickToBottomRef.current = true;
          return;
        }
        stickToBottomRef.current = entry.isIntersecting;
      },
      { root, threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    scrollTranscriptToBottom();
  }, [messages, generating]);

  async function prepareModel() {
    setError(null);
    setPhase("downloading");
    setDownloadProgress(0);
    try {
      await provider.initialize({
        onDownloadProgress: (loaded) => {
          setDownloadProgress(loaded);
          setPhase("downloading");
        },
      });
      setContextUsage(provider.getContextUsage());
      setPhase("ready");
      setDownloadProgress(null);
    } catch (caught) {
      const message = categorizeError(caught) || "Chrome couldn't prepare the local model.";
      setError(message);
      setPhase("error");
    }
  }

  async function addFiles(fileList) {
    const files = [...(fileList || [])];
    if (!files.length) return;
    setFileError(null);
    if (attachments.length + files.length > MAX_ATTACHMENTS) {
      setFileError(`You can attach up to ${MAX_ATTACHMENTS} items.`);
      return;
    }
    try {
      const prepared = await prepareFiles(files, capabilities);
      setAttachments((current) => [...current, ...prepared]);
    } catch (caught) {
      setFileError(caught.message || "Couldn't attach that file.");
    }
  }

  function removeAttachment(id) {
    setAttachments((current) => {
      const target = current.find((item) => item.id === id);
      if (target) revokeAttachment(target);
      return current.filter((item) => item.id !== id);
    });
  }

  async function handleCameraCapture(blob) {
    setCameraOpen(false);
    setFileError(null);
    try {
      const attachment = await prepareCameraCapture(blob);
      setAttachments((current) => [...current, attachment]);
    } catch (caught) {
      setFileError(caught.message || "Couldn't capture from the camera.");
    }
  }

  async function handleMicrophoneCapture(blob) {
    setFileError(null);
    if (attachments.length >= MAX_ATTACHMENTS) {
      setFileError(`You can attach up to ${MAX_ATTACHMENTS} items.`);
      return;
    }
    try {
      const attachment = await prepareMicrophoneCapture(blob);
      setAttachments((current) => [...current, attachment]);
    } catch (caught) {
      setFileError(caught.message || "Couldn't attach the recording.");
    }
  }

  async function sendMessage(textOverride) {
    const text = (textOverride ?? draft).trim();
    if ((!text && !attachments.length) || generating || phase !== "ready") return;

    const outgoingAttachments = attachments;
    if (promptNeedsImage(text) && !hasVisualAttachment(outgoingAttachments)) {
      setFileError("Attach an image first. Nothing was attached, so the model has nothing to look at.");
      return;
    }
    const media = outgoingAttachments.flatMap(attachmentToMediaParts);
    const userMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text,
      attachments: outgoingAttachments,
    };
    const assistantId = crypto.randomUUID();

    setDraft("");
    setAttachments([]);
    setError(null);
    setContextNotice(false);
    stickToBottomRef.current = true;
    setMessages((current) => [
      ...current,
      userMessage,
      { id: assistantId, role: "assistant", text: "", attachments: [], stopped: false },
    ]);
    setGenerating(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const input = buildPromptInput(text, media);
      await provider.stream(
        input,
        (nextText) => {
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId ? { ...message, text: nextText } : message,
            ),
          );
        },
        controller.signal,
      );
      setContextUsage(provider.getContextUsage());
    } catch (caught) {
      const message = categorizeError(caught);
      if (message) {
        setError(message);
        setMessages((current) =>
          current.map((item) =>
            item.id === assistantId && !item.text
              ? { ...item, text: message }
              : item,
          ),
        );
      } else {
        setMessages((current) =>
          current.map((item) =>
            item.id === assistantId ? { ...item, stopped: true } : item,
          ),
        );
      }
    } finally {
      setGenerating(false);
      abortRef.current = null;
    }
  }

  function stopGeneration() {
    abortRef.current?.abort();
  }

  async function newChat() {
    abortRef.current?.abort();
    setGenerating(false);
    setMessages((current) => {
      for (const message of current) {
        revokeAll(message.attachments || []);
      }
      return [];
    });
    setError(null);
    setContextNotice(false);
    revokeAll(attachments);
    setAttachments([]);
    stickToBottomRef.current = true;
    provider.destroy();
    if (phase === "ready" || phase === "error") {
      try {
        await provider.initialize();
        setContextUsage(provider.getContextUsage());
        setPhase("ready");
      } catch (caught) {
        setError(categorizeError(caught) || "Couldn't start a new chat.");
        setPhase("error");
      }
    }
  }

  function onDragEnter(event) {
    event.preventDefault();
    dragDepth.current += 1;
    setDragActive(true);
  }

  function onDragLeave(event) {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragActive(false);
  }

  function onDragOver(event) {
    event.preventDefault();
  }

  function onDrop(event) {
    event.preventDefault();
    dragDepth.current = 0;
    setDragActive(false);
    if (phase === "ready" && !generating) {
      addFiles(event.dataTransfer.files);
    }
  }

  const blocked = phase === "unsupported" || phase === "unavailable";
  const composerDisabled = phase !== "ready";

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <h1>Built-in Chat</h1>
          <span>On-device in Chrome</span>
        </div>
        <div className="topbar-actions">
          <ModelStatus
            phase={generating ? "ready" : phase}
            downloadProgress={downloadProgress}
            generating={generating}
            contextUsage={contextUsage}
          />
          <button type="button" className="text-btn" onClick={newChat} disabled={phase === "checking"}>
            New chat
          </button>
          <InstallApp />
          <button
            type="button"
            className="icon-btn"
            onClick={onToggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title="Toggle theme"
          >
            {theme === "dark" ? "☀" : "☾"}
          </button>
        </div>
      </header>

      <main
        className="chat-layout"
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <div
          className="transcript"
          ref={transcriptRef}
          onScroll={onTranscriptScroll}
          onWheel={onTranscriptWheel}
          onTouchStart={unpinFromBottom}
          onPointerDown={(event) => {
            if (event.pointerType === "touch" || event.target === transcriptRef.current) {
              unpinFromBottom();
            }
          }}
        >
          <div className="transcript-inner">
            {blocked ? <CompatibilityPanel phase={phase} /> : null}

            {phase === "downloadable" ? (
              <section className="banner">
                <p>
                  <strong>Prepare local AI.</strong> Chrome needs to download the on-device model once
                  before you can chat. This can take a few minutes and requires a click to start.
                </p>
                <button type="button" className="prepare-btn" onClick={prepareModel}>
                  Prepare local AI
                </button>
              </section>
            ) : null}

            {phase === "downloading" ? (
              <section className="banner">
                <p>
                  <strong>Preparing local AI</strong>
                </p>
                <p>
                  Chrome is downloading the model needed for this chatbot. This only needs to happen when
                  the model isn't already available.
                </p>
                <button type="button" className="prepare-btn" onClick={prepareModel}>
                  Continue
                </button>
              </section>
            ) : null}

            {phase === "ready" && messages.length === 0 ? (
              <section className="empty-state">
                <h2>A local model, in the browser.</h2>
                <p>
                  Prompts are processed by Chrome's built-in AI on this device. This app doesn't send your
                  prompts to our AI server.
                </p>
                <div className="starters">
                  {STARTERS.map((starter) => (
                    <button
                      type="button"
                      className="starter"
                      key={starter.label}
                      onClick={() => {
                        setDraft(starter.text);
                        if (starter.needsImage && !hasVisualAttachment(attachments)) {
                          setFileError("Attach an image, then send.");
                        } else {
                          setFileError(null);
                        }
                      }}
                    >
                      <small>{starter.label}</small>
                      {starter.text}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {phase === "error" && error ? (
              <section className="banner error-banner">
                <p>{error}</p>
                <button type="button" className="prepare-btn" onClick={prepareModel}>
                  Try again
                </button>
              </section>
            ) : null}

            {contextNotice ? (
              <section className="banner">
                <p>The conversation reached the model's context window. Older turns may be dropped.</p>
              </section>
            ) : null}

            {error && phase === "ready" ? (
              <section className="banner error-banner">
                <p>{error}</p>
              </section>
            ) : null}

            {messages.map((message) => (
              <Message key={message.id} message={message} />
            ))}
            <div className="transcript-end" ref={bottomSentinelRef} aria-hidden="true" />
          </div>
        </div>

        <Composer
          value={draft}
          onChange={setDraft}
          attachments={attachments}
          onRemoveAttachment={removeAttachment}
          onPickFiles={addFiles}
          onCameraCapture={handleCameraCapture}
          cameraOpen={cameraOpen}
          onCameraOpen={() => setCameraOpen(true)}
          onCameraClose={() => setCameraOpen(false)}
          onMicrophoneCapture={handleMicrophoneCapture}
          onToolError={setFileError}
          disabled={composerDisabled}
          generating={generating}
          capabilities={capabilities}
          fileError={fileError}
          onSend={() => sendMessage()}
          onStop={stopGeneration}
          dragActive={dragActive}
        />
      </main>

      {dragActive && !composerDisabled ? (
        <div className="drop-mask">
          <span>Drop an image, audio, or video file</span>
        </div>
      ) : null}
    </>
  );
}
