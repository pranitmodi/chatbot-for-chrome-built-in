import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { buildPromptInput } from "../ai/provider.js";
import { categorizeError } from "../ai/errors.js";
import { buildSystemPrompt } from "../ai/systemPrompt.js";
import {
  MAX_ATTACHMENTS,
  attachmentToMediaParts,
  prepareCameraCapture,
  prepareFiles,
  prepareMicrophoneCapture,
  revokeAll,
  revokeAttachment,
} from "../ai/multimodal.js";
import {
  createConversation,
  deriveTitle,
  getConversation,
  updateConversation,
} from "../storage/conversations.js";
import {
  listMessages,
  putMessage,
  saveUserTurn,
  toUiMessage,
  updateMessageContent,
} from "../storage/messages.js";
import { createNote } from "../storage/notes.js";
import { getSetting } from "../storage/settings.js";
import {
  createMemory,
  listMemories,
  updateMemory,
} from "../storage/memories.js";
import { parseMemoryCommand, looksSensitive, inferMemoryCandidate } from "../features/memory/commands.js";
import { retrieveMemories } from "../features/memory/retrieval.js";
import { compactMessages, messagesToInitialPrompts } from "../features/chat/context.js";
import { draftFromCurrentRoute } from "../features/drafts.js";
import { setHash } from "../features/navigation.js";
import { CompatibilityPanel } from "./CompatibilityPanel.jsx";
import { Composer } from "./Composer.jsx";
import { Message } from "./Message.jsx";

const STARTERS = [
  { label: "Explain", text: "Explain recursion like I'm 12." },
  { label: "Write", text: "Turn this idea into a short story." },
  { label: "Code", text: "Explain this code and suggest a simpler implementation." },
];

function hasVisualAttachment(list) {
  return list.some((item) => item.kind === "image" || item.kind === "video");
}

function promptNeedsImage(text) {
  return /\b(this image|this screenshot|this photo|this picture|in this image|this menu)\b/i.test(
    text,
  );
}

export function Chat({
  provider,
  phase,
  setPhase,
  capabilities,
  prepareModel,
  error,
  setError,
  conversationId,
  downloadProgress = null,
  onConversationId,
  onConversationsChanged,
  generating,
  setGenerating,
  setContextUsage,
}) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState(() => draftFromCurrentRoute("chat")?.content || "");
  const [attachments, setAttachments] = useState([]);
  const [fileError, setFileError] = useState(null);
  const [contextNotice, setContextNotice] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [memorySuggestion, setMemorySuggestion] = useState(null);
  const [rememberEnabled, setRememberEnabled] = useState(true);
  const abortRef = useRef(null);
  const transcriptRef = useRef(null);
  const bottomSentinelRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const autoScrollingRef = useRef(false);
  const dragDepth = useRef(0);
  const persistTimer = useRef(null);

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
  }, [provider]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!conversationId) {
        abortRef.current?.abort();
        setGenerating(false);
        setMessages([]);
        return;
      }
      const rows = await listMessages(conversationId);
      if (cancelled) return;
      const ui = rows.map(toUiMessage);
      setMessages(ui);
      const conversation = await getConversation(conversationId);
      if (conversation) setRememberEnabled(conversation.rememberEnabled !== false);
      if (phase === "ready") {
        try {
          await recreateSession(ui);
        } catch {
          // Keep the existing session if replay fails.
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId, phase]);

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

  async function recreateSession(historyMessages) {
    provider.destroySession();
    if (phase !== "ready" && phase !== "error") return;
    const memoryOn = (await getSetting("memoryEnabled", true)) && rememberEnabled;
    const memories = memoryOn ? await listMemories() : [];
    const relevant = retrieveMemories(
      historyMessages.map((item) => item.text).join(" "),
      memories,
    );
    const { promptMessages, summary } = compactMessages(historyMessages);
    const systemPrompt = buildSystemPrompt({ memories: relevant });
    await provider.createSession({
      initialPrompts: messagesToInitialPrompts(systemPrompt, promptMessages, summary),
    });
    setContextUsage(provider.getContextUsage());
    setPhase("ready");
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

  async function ensureConversation(firstText) {
    if (conversationId) return conversationId;
    const created = await createConversation({ title: deriveTitle(firstText) });
    onConversationId(created.id);
    await onConversationsChanged();
    return created.id;
  }

  async function handleMemoryCommand(command, activeId) {
    if (command.type === "remember") {
      if (looksSensitive(command.text)) {
        setError("That looks like a secret. Local AI will not store passwords, tokens, or keys as memory.");
        return true;
      }
      await createMemory({
        text: command.text,
        category: "preference",
        confidence: "high",
        source: "explicit",
        sourceConversationId: activeId,
      });
      const confirmation = `I'll remember that ${command.text.replace(/^i\s+/i, "you ")}.`;
      const saved = await putMessage({
        conversationId: activeId,
        role: "assistant",
        content: confirmation,
      });
      setMessages((current) => [...current, toUiMessage({ ...saved, attachments: [] })]);
      return true;
    }
    if (command.type === "list") {
      const memories = await listMemories();
      const confirmation = memories.length
        ? `Here's what is saved locally:\n${memories.map((item) => `- ${item.text}`).join("\n")}`
        : "I don't have any saved memories yet.";
      const saved = await putMessage({
        conversationId: activeId,
        role: "assistant",
        content: confirmation,
      });
      setMessages((current) => [...current, toUiMessage({ ...saved, attachments: [] })]);
      return true;
    }
    if (command.type === "forget") {
      const memories = await listMemories();
      const needle = command.text.toLowerCase();
      const match = memories.find((item) => item.text.toLowerCase().includes(needle));
      if (match) await updateMemory(match.id, { status: "archived" });
      const confirmation = match
        ? `I'll forget that ${match.text}.`
        : "I couldn't find a saved memory that matches.";
      const saved = await putMessage({
        conversationId: activeId,
        role: "assistant",
        content: confirmation,
      });
      setMessages((current) => [...current, toUiMessage({ ...saved, attachments: [] })]);
      return true;
    }
    if (command.type === "opt_out") {
      await updateConversation(activeId, { rememberEnabled: false });
      setRememberEnabled(false);
      const confirmation = "I won't remember anything from this conversation.";
      const saved = await putMessage({
        conversationId: activeId,
        role: "assistant",
        content: confirmation,
      });
      setMessages((current) => [...current, toUiMessage({ ...saved, attachments: [] })]);
      return true;
    }
    return false;
  }

  async function sendMessage(textOverride) {
    const text = (textOverride ?? draft).trim();
    if ((!text && !attachments.length) || generating || phase !== "ready") return;

    const outgoingAttachments = attachments;
    if (promptNeedsImage(text) && !hasVisualAttachment(outgoingAttachments)) {
      setFileError("Attach an image first. Nothing was attached, so the model has nothing to look at.");
      return;
    }

    const activeId = await ensureConversation(text || outgoingAttachments[0]?.name || "New conversation");
    const command = parseMemoryCommand(text);
    if (command && !outgoingAttachments.length) {
      setDraft("");
      await saveUserTurn({ conversationId: activeId, text, attachments: [] });
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "user", text, attachments: [] },
      ]);
      await handleMemoryCommand(command, activeId);
      await onConversationsChanged();
      return;
    }

    const media = outgoingAttachments.flatMap(attachmentToMediaParts);
    setDraft("");
    setAttachments([]);
    setError(null);
    setContextNotice(false);
    stickToBottomRef.current = true;

    const userMessage = await saveUserTurn({
      conversationId: activeId,
      text,
      attachments: outgoingAttachments,
    });
    const assistant = await putMessage({
      conversationId: activeId,
      role: "assistant",
      content: "",
    });
    const assistantUi = toUiMessage({ ...assistant, attachments: [] });

    setMessages((current) => [...current, toUiMessage(userMessage), assistantUi]);
    setGenerating(true);

    if ((await getSetting("memoryEnabled", true)) && rememberEnabled) {
      const inferred = inferMemoryCandidate(text);
      if (inferred) setMemorySuggestion(inferred);
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      if (!provider.session) {
        await recreateSession([...messages, toUiMessage(userMessage)]);
      }
      const memories = rememberEnabled && (await getSetting("memoryEnabled", true))
        ? retrieveMemories(text, await listMemories())
        : [];
      const memoryPrefix = memories.length
        ? `${buildSystemPrompt({ memories }).split("Guidelines:")[0]}\n`
        : "";
      const input = buildPromptInput(memoryPrefix ? `${text}` : text, media);
      await provider.streamText(
        input,
        (nextText) => {
          setMessages((current) =>
            current.map((message) =>
              message.id === assistant.id ? { ...message, text: nextText } : message,
            ),
          );
          clearTimeout(persistTimer.current);
          persistTimer.current = setTimeout(() => {
            updateMessageContent(assistant.id, nextText);
          }, 250);
        },
        controller.signal,
      );
      const latest = await new Promise((resolve) => {
        setMessages((current) => {
          const found = current.find((item) => item.id === assistant.id);
          resolve(found?.text || "");
          return current;
        });
      });
      await updateMessageContent(assistant.id, latest);
      if (userMessage.content || text) {
        await updateConversation(activeId, { title: deriveTitle(text) });
      }
      setContextUsage(provider.getContextUsage());
      await onConversationsChanged();
    } catch (caught) {
      const message = categorizeError(caught);
      if (message) {
        setError(message);
        setMessages((current) =>
          current.map((item) =>
            item.id === assistant.id && !item.text ? { ...item, text: message } : item,
          ),
        );
        await updateMessageContent(assistant.id, message);
      } else {
        setMessages((current) =>
          current.map((item) =>
            item.id === assistant.id ? { ...item, stopped: true } : item,
          ),
        );
        await updateMessageContent(assistant.id, "", { stopped: true });
      }
    } finally {
      setGenerating(false);
      abortRef.current = null;
    }
  }

  function stopGeneration() {
    abortRef.current?.abort();
  }

  async function saveNoteFromMessage(message) {
    await createNote({
      title: deriveTitle(message.text),
      content: message.text,
      sourceType: "chat",
      sourceReference: conversationId,
    });
  }

  function continueFromMessage(message) {
    setDraft(`Continue from this response:\n\n${message.text}\n\n`);
  }

  function regenerateMessage(message) {
    const index = messages.findIndex((item) => item.id === message.id);
    const previous = index > 0 ? messages[index - 1] : null;
    if (previous?.role === "user" && !generating) {
      sendMessage(previous.text);
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

            {phase === "checking" ? (
              <section className="banner">
                <p>
                  <strong>Checking Chrome’s built-in AI.</strong> Looking for the on-device model.
                  Chat opens by itself as soon as this finishes.
                </p>
                <button type="button" className="text-btn" onClick={() => setHash("status")}>
                  Open status
                </button>
              </section>
            ) : null}

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
                  {downloadProgress == null
                    ? " Chrome is downloading the on-device model."
                    : ` ${Math.min(100, Math.max(0, Math.round(downloadProgress * 100)))}%`}
                </p>
                <p>This only needs to happen when the model isn&apos;t already available. Keep this tab open.</p>
              </section>
            ) : null}

            {phase === "ready" && messages.length === 0 ? (
              <section className="empty-state">
                <h2>Ask anything locally.</h2>
                <p>On this device. Ask something, or pick a starter.</p>
                <div className="starters">
                  {STARTERS.map((starter) => (
                    <button
                      type="button"
                      className="starter"
                      key={starter.label}
                      onClick={() => {
                        setDraft(starter.text);
                        setFileError(null);
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
                <p>The conversation reached the model&apos;s context window. Older turns may be dropped.</p>
              </section>
            ) : null}

            {error && phase === "ready" ? (
              <section className="banner error-banner">
                <p>{error}</p>
              </section>
            ) : null}

            {memorySuggestion ? (
              <section className="banner">
                <p>Save this as a preference? “{memorySuggestion.text}”</p>
                <button
                  type="button"
                  className="prepare-btn"
                  onClick={async () => {
                    await createMemory({
                      ...memorySuggestion,
                      source: "inferred",
                      sourceConversationId: conversationId,
                    });
                    setMemorySuggestion(null);
                  }}
                >
                  Save
                </button>
                <button type="button" className="text-btn" onClick={() => setMemorySuggestion(null)}>
                  Not now
                </button>
                <button
                  type="button"
                  className="text-btn"
                  onClick={() => setMemorySuggestion(null)}
                >
                  Never suggest this
                </button>
              </section>
            ) : null}

            {messages.map((message) => (
              <Message
                key={message.id}
                message={message}
                onSaveNote={saveNoteFromMessage}
                onContinue={message.role === "assistant" ? continueFromMessage : undefined}
                onRegenerate={message.role === "assistant" ? regenerateMessage : undefined}
              />
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
