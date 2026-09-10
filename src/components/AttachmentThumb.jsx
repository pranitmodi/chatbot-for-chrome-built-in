import { useEffect, useState } from "react";

export function AttachmentThumb({ attachment }) {
  const [open, setOpen] = useState(false);
  const isVisual = attachment.kind === "image" || attachment.kind === "video";

  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (attachment.kind === "audio" && attachment.previewUrl) {
    return <audio src={attachment.previewUrl} controls preload="metadata" />;
  }

  if (!isVisual || !attachment.previewUrl) return null;

  return (
    <>
      <button
        type="button"
        className="attachment-thumb"
        onClick={() => setOpen(true)}
        aria-label={`Preview ${attachment.name}`}
        title="View preview"
      >
        <img src={attachment.previewUrl} alt="" />
      </button>
      {open ? (
        <div
          className="preview-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`Preview of ${attachment.name}`}
          onClick={() => setOpen(false)}
        >
          <div className="preview-card" onClick={(event) => event.stopPropagation()}>
            <img src={attachment.previewUrl} alt={attachment.name} />
            <div className="preview-caption">
              <span>{attachment.name}</span>
              <button type="button" className="text-btn" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
