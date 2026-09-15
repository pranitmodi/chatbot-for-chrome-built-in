import { renderMarkdown } from "../ai/markdown.js";
import { formatBytes } from "../ai/multimodal.js";
import { AttachmentThumb } from "./AttachmentThumb.jsx";

function AttachmentList({ attachments }) {
  if (!attachments?.length) return null;
  return (
    <div className="attachment-row">
      {attachments.map((attachment) => (
        <div className="attachment-chip" key={attachment.id}>
          <AttachmentThumb attachment={attachment} />
          <div className="meta">
            <strong>{attachment.name}</strong>
            <span>
              {attachment.kind === "video"
                ? `${attachment.frameCount} frames · ${formatBytes(attachment.size)}`
                : formatBytes(attachment.size)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <circle cx="10" cy="7.2" r="2.7" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M4.6 16.2c.6-3.2 2.7-4.8 5.4-4.8s4.8 1.6 5.4 4.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function AssistantIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <path
        d="M10 3.2 11.15 8.2 16.2 9.4 11.15 10.6 10 15.6 8.85 10.6 3.8 9.4 8.85 8.2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Avatar({ role }) {
  const isUser = role === "user";
  return (
    <div className={`avatar ${role}`} aria-hidden="true">
      {isUser ? <UserIcon /> : <AssistantIcon />}
    </div>
  );
}

export function Message({ message, onSaveNote }) {
  const isUser = message.role === "user";
  const html = !isUser && message.text ? renderMarkdown(message.text) : "";

  return (
    <article className={`message ${message.role}`} aria-label={isUser ? "You" : "Assistant"}>
      {!isUser ? <Avatar role="assistant" /> : null}
      <div className="message-body">
        <AttachmentList attachments={message.attachments} />
        {isUser ? (
          message.text ? <div className="bubble">{message.text}</div> : null
        ) : (
          <div className="bubble markdown">
            {message.text ? (
              <div dangerouslySetInnerHTML={{ __html: html }} />
            ) : (
              <span className="thinking">Thinking…</span>
            )}
          </div>
        )}
        {message.stopped ? <div className="stopped">Generation stopped.</div> : null}
        {!isUser && message.text && onSaveNote ? (
          <button type="button" className="text-btn save-note" onClick={() => onSaveNote(message)}>
            Save as note
          </button>
        ) : null}
      </div>
      {isUser ? <Avatar role="user" /> : null}
    </article>
  );
}
