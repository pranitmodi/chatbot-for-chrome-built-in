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
  ...NAV_GROUPS.flatMap((group) => group.items),
];

export const VIEW_TITLES = Object.fromEntries(
  [{ id: "home", label: "Home" }, ...NAV_GROUPS.flatMap((group) => group.items)].map((item) => [
    item.id,
    item.label,
  ]),
);

export function parseHash() {
  const raw = window.location.hash.replace(/^#\/?/, "");
  const [path, queryString] = raw.split("?");
  const params = new URLSearchParams(queryString || "");
  const view = path || "chat";
  return { view, params };
}

export function setHash(view, params) {
  const search = params?.toString();
  window.location.hash = search ? `#/${view}?${search}` : `#/${view}`;
}
