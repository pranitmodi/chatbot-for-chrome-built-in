export function ModelStatus({ phase, downloadProgress, generating, contextUsage }) {
  const percent =
    downloadProgress == null ? null : Math.min(100, Math.max(0, Math.round(downloadProgress * 100)));

  let label = "Checking local AI…";
  let tone = "busy";

  if (phase === "unsupported" || phase === "unavailable") {
    label = "Built-in AI unavailable";
    tone = "bad";
  } else if (phase === "downloadable") {
    label = "Prepare local AI";
    tone = "busy";
  } else if (phase === "downloading") {
    label = percent == null ? "Preparing local AI…" : `Preparing local AI… ${percent}%`;
    tone = "busy";
  } else if (phase === "ready" && generating) {
    label = "Thinking…";
    tone = "busy";
  } else if (phase === "ready") {
    label = "Local AI ready";
    tone = "ready";
  } else if (phase === "error") {
    label = "Something went wrong";
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
