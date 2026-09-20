export const NAV_GROUPS = [
  {
    id: "ask",
    label: "Ask",
    items: [
      { id: "chat", label: "Chat", icon: "chat" },
      { id: "page", label: "This page", icon: "page" },
      { id: "explain", label: "Selection", icon: "explain" },
      { id: "image", label: "Image", icon: "image" },
    ],
  },
  {
    id: "write",
    label: "Write",
    items: [
      { id: "summarize", label: "Summarize", icon: "summarize" },
      { id: "rewrite", label: "Rewrite", icon: "rewrite" },
      { id: "proofread", label: "Proofread", icon: "proofread" },
      { id: "extract", label: "Extract", icon: "extract" },
      { id: "study", label: "Study", icon: "study" },
    ],
  },
  {
    id: "library",
    label: "Keep",
    items: [
      { id: "notes", label: "Notes", icon: "notes" },
      { id: "memory", label: "Memory", icon: "memory" },
      { id: "status", label: "Status", icon: "status" },
    ],
  },
];

export const VIEWS = [
  { id: "home", label: "Home" },
  { id: "setup", label: "Set up" },
  ...NAV_GROUPS.flatMap((group) => group.items),
];

export const VIEW_TITLES = Object.fromEntries(
  [
    { id: "home", label: "Home" },
    { id: "setup", label: "Set up" },
    ...NAV_GROUPS.flatMap((group) => group.items),
  ].map((item) => [item.id, item.label]),
);

export function isKnownView(view) {
  return VIEWS.some((item) => item.id === view);
}

export function parseHash(fallback = "home") {
  const raw = window.location.hash.replace(/^#\/?/, "");
  const [path, queryString] = raw.split("?");
  const params = new URLSearchParams(queryString || "");
  const view = path || fallback;
  return { view, params };
}

export function setHash(view, params) {
  const search = params?.toString();
  window.location.hash = search ? `#/${view}?${search}` : `#/${view}`;
}

const ALLOWED_HANDOFF_ACTIONS = new Set([
  "ask",
  "summarize",
  "explain",
  "clearer",
  "rewrite",
]);

export function consumeHandoff(expectedView) {
  const { view, params } = parseHash();
  if (view !== expectedView) return null;
  const id = params.get("handoff");
  if (!id || !/^[a-zA-Z0-9-]{8,80}$/.test(id)) return null;
  const key = `local-ai-handoff:${id}`;
  const payload = params.get("payload");

  if (payload != null) {
    const requestedAction = params.get("action") || "";
    const action = ALLOWED_HANDOFF_ACTIONS.has(requestedAction)
      ? requestedAction
      : "";
    const handoff = {
      id,
      view,
      action,
      payload: payload.slice(0, 7000),
      autoRun: params.get("autorun") === "1" && Boolean(action),
    };
    sessionStorage.setItem(key, JSON.stringify(handoff));
    const clean = new URLSearchParams({ handoff: id });
    window.history.replaceState(null, "", `#/${view}?${clean.toString()}`);
    return handoff;
  }

  try {
    const stored = JSON.parse(sessionStorage.getItem(key) || "null");
    return stored?.view === expectedView ? stored : null;
  } catch {
    return null;
  }
}

export function handoffHasRun(id) {
  return sessionStorage.getItem(`local-ai-handoff-ran:${id}`) === "1";
}

export function markHandoffRun(id) {
  sessionStorage.setItem(`local-ai-handoff-ran:${id}`, "1");
}
