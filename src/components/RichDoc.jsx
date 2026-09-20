import { useEffect, useId, useRef, useState } from "react";
import { renderMarkdown } from "../ai/markdown.js";

function looksLikeJson(text) {
  const trimmed = text.trim();
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return false;
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

/** Format plain model output for richer markdown display (JSON fences, etc.). */
export function enrichDisplayText(text) {
  if (!text) return "";
  const trimmed = text.trim();
  if (looksLikeJson(trimmed) && !trimmed.includes("```")) {
    try {
      return `\`\`\`json\n${JSON.stringify(JSON.parse(trimmed), null, 2)}\n\`\`\``;
    } catch {
      return `\`\`\`json\n${trimmed}\n\`\`\``;
    }
  }
  return text;
}

function attachCodeCopyButtons(root) {
  if (!root) return () => {};
  const cleanups = [];

  root.querySelectorAll("pre").forEach((pre) => {
    if (pre.closest(".code-block")) return;
    const wrap = document.createElement("div");
    wrap.className = "code-block";
    pre.parentNode.insertBefore(wrap, pre);
    wrap.appendChild(pre);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "code-copy-btn";
    btn.textContent = "Copy";
    btn.setAttribute("aria-label", "Copy code");
    wrap.appendChild(btn);

    const onClick = async () => {
      const code = pre.innerText;
      try {
        await navigator.clipboard.writeText(code);
        btn.textContent = "Copied";
        setTimeout(() => {
          btn.textContent = "Copy";
        }, 1200);
      } catch {
        btn.textContent = "Failed";
        setTimeout(() => {
          btn.textContent = "Copy";
        }, 1200);
      }
    };
    btn.addEventListener("click", onClick);
    cleanups.push(() => btn.removeEventListener("click", onClick));
  });

  return () => cleanups.forEach((fn) => fn());
}

export function RichInput({
  value,
  onChange,
  placeholder,
  label = "Input",
  disabled = false,
  onClear,
  "aria-label": ariaLabel,
}) {
  const id = useId();
  return (
    <div className="rich-input">
      <div className="rich-toolbar">
        <label htmlFor={id}>{label}</label>
        {value && onClear ? (
          <button type="button" className="text-btn" onClick={onClear} disabled={disabled}>
            Clear
          </button>
        ) : null}
      </div>
      <textarea
        id={id}
        className="rich-input-field"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel || label}
        rows={6}
      />
    </div>
  );
}

export function RichResult({
  value,
  onChange,
  busy = false,
  emptyHint = "Run locally to see a result here.",
  actions,
}) {
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const previewRef = useRef(null);
  const display = enrichDisplayText(value);
  const html = display ? renderMarkdown(display) : "";

  useEffect(() => {
    if (editing || !previewRef.current) return undefined;
    return attachCodeCopyButtons(previewRef.current);
  }, [html, editing]);

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  async function copyAsCode() {
    let payload = value;
    if (looksLikeJson(value)) {
      try {
        payload = JSON.stringify(JSON.parse(value.trim()), null, 2);
      } catch {
        payload = value;
      }
    }
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  if (!value && !busy) {
    return <p className="tool-empty muted">{emptyHint}</p>;
  }

  return (
    <article className="rich-result">
      <div className="rich-toolbar">
        <span className="rich-toolbar-label">{busy ? "Writing…" : "Result"}</span>
        <div className="rich-toolbar-actions">
          {actions}
          {value ? (
            <>
              <button
                type="button"
                className={`text-btn${editing ? " active" : ""}`}
                onClick={() => setEditing((v) => !v)}
              >
                {editing ? "Preview" : "Edit"}
              </button>
              <button type="button" className="text-btn" onClick={copyAll}>
                {copied ? "Copied" : "Copy"}
              </button>
              <button type="button" className="text-btn" onClick={copyAsCode} title="Copy raw text / JSON">
                Copy as code
              </button>
            </>
          ) : null}
        </div>
      </div>

      {editing ? (
        <textarea
          className="rich-result-editor"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label="Edit result"
          rows={10}
        />
      ) : (
        <div className="rich-result-body markdown" ref={previewRef}>
          {value ? (
            <div dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <span className="thinking">Thinking…</span>
          )}
        </div>
      )}
    </article>
  );
}
