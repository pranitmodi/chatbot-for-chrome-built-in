import { attachmentMetaLabel } from "../ai/multimodal.js";
import { AttachmentThumb } from "./AttachmentThumb.jsx";

export function AttachmentPreview({ attachments, onRemove }) {
  if (!attachments.length) return null;

  return (
    <div className="attachment-row" style={{ margin: "4px 8px 8px" }}>
      {attachments.map((attachment) => (
        <div className="attachment-chip" key={attachment.id}>
          <AttachmentThumb attachment={attachment} />
          <div className="meta">
            <strong title={attachment.name}>{attachment.name}</strong>
            <span>{attachmentMetaLabel(attachment)}</span>
          </div>
          <button type="button" onClick={() => onRemove(attachment.id)} aria-label={`Remove ${attachment.name}`}>
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}
