export function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <path
        d="M10 4.5v11M4.5 10h11"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CameraIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <path
        d="M7.2 6.2 8 5h4l.8 1.2H15a1.3 1.3 0 0 1 1.3 1.3v6.2A1.3 1.3 0 0 1 15 15H5a1.3 1.3 0 0 1-1.3-1.3V7.5A1.3 1.3 0 0 1 5 6.2h2.2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10.4" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function MicIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <rect x="7.4" y="3.2" width="5.2" height="8.2" rx="2.6" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M5.4 10.2a4.6 4.6 0 0 0 9.2 0M10 14.8V17"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ComposerToolButton({
  type = "button",
  label,
  title,
  disabled = false,
  pressed = false,
  onClick,
  children,
}) {
  return (
    <button
      type={type}
      className={`icon-btn${pressed ? " recording" : ""}`}
      disabled={disabled}
      title={title}
      aria-label={label}
      aria-pressed={pressed ? true : undefined}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
