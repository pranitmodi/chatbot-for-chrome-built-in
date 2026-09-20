export function ModelStatus({ phase, downloadProgress, generating, contextUsage, offline }) {
  const percent =
    downloadProgress == null ? null : Math.min(100, Math.max(0, Math.round(downloadProgress * 100)));

  let label = "Checking local AI…";
  let tone = "busy";

  if (phase === "unsupported" || phase === "unavailable") {
    label = "Local AI not available";
    tone = "bad";
  } else if (phase === "downloadable") {
    label = "Local AI not prepared";
    tone = "busy";
  } else if (phase === "downloading") {
    label = percent == null ? "Preparing Local AI…" : `Preparing Local AI… ${percent}%`;
    tone = "busy";
  } else if (phase === "ready" && generating) {
    label = "Thinking…";
    tone = "busy";
  } else if (phase === "ready" && offline) {
    label = "Local AI offline";
    tone = "ready";
  } else if (phase === "ready") {
    label = "Local AI ready";
    tone = "ready";
  } else if (phase === "error") {
    label = "Local AI needs attention";
    tone = "bad";
  }

  return (
    <div className={`status-chip ${tone}`} title={label}>
      <span className="status-dot" />
      <span>{label}</span>
      {phase === "ready" && contextUsage?.window ? (
        <span className="context-meter">
          {contextUsage.usage}/{contextUsage.window}
        </span>
      ) : null}
    </div>
  );
}
