export function isAppShellCached() {
  return typeof navigator !== "undefined" && Boolean(navigator.serviceWorker?.controller);
}

export function watchAppShell(onChange) {
  if (typeof navigator === "undefined" || !navigator.serviceWorker) {
    return () => {};
  }
  const notify = () => onChange(isAppShellCached());
  navigator.serviceWorker.addEventListener("controllerchange", notify);
  return () => navigator.serviceWorker.removeEventListener("controllerchange", notify);
}
