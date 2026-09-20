const NOISE = [
  "nav",
  "header",
  "footer",
  "aside",
  "script",
  "style",
  "noscript",
  "iframe",
  "[aria-hidden='true']",
  "[class*='cookie']",
  "[id*='cookie']",
];

function extractPage() {
  const clone = document.body ? document.body.cloneNode(true) : document.documentElement.cloneNode(true);
  for (const selector of NOISE) {
    clone.querySelectorAll(selector).forEach((node) => node.remove());
  }
  const article = clone.querySelector("article, main, [role='main']") || clone;
  const headings = [...article.querySelectorAll("h1, h2, h3")]
    .map((node) => (node.textContent || "").trim())
    .filter(Boolean)
    .slice(0, 20);
  let text = (article.innerText || "").replace(/[ \t]+/g, " ").trim();
  const truncated = text.length > 12000;
  if (truncated) text = text.slice(0, 12000);
  return {
    title: document.title,
    url: location.href,
    headings,
    selection: window.getSelection?.()?.toString()?.trim() || "",
    text,
    truncated,
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "local-ai:extract") {
    sendResponse(extractPage());
    return true;
  }
  if (message?.type === "local-ai:selection") {
    sendResponse({ selection: window.getSelection?.()?.toString()?.trim() || "" });
    return true;
  }
  return undefined;
});

async function isConfiguredAppOrigin() {
  const { appUrl = "https://builtinchrome.project93.in/" } =
    await chrome.storage.local.get("appUrl");
  try {
    return location.origin === new URL(appUrl).origin;
  } catch {
    return location.origin === "https://builtinchrome.project93.in";
  }
}

async function reportAppStatus({ allowUnconfirmed = false } = {}) {
  if (!(await isConfiguredAppOrigin())) return;
  const phase = document.documentElement.dataset.localAiPhase;
  if (!phase && !allowUnconfirmed) return;
  chrome.runtime.sendMessage({
    type: "local-ai:app-status",
    phase: phase || "unconfirmed",
    origin: location.origin,
    updatedAt: Date.now(),
  }).catch(() => {});
}

if (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1") {
  reportAppStatus();
  const statusObserver = new MutationObserver(() => reportAppStatus());
  statusObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-local-ai-phase"],
  });
  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== location.origin) return;
    if (event.data?.type === "local-ai:status") reportAppStatus();
  });
  // A deployment without the readiness bridge never sets the attribute. Say so explicitly
  // instead of leaving the popup waiting for a confirmation that will never arrive.
  setTimeout(() => reportAppStatus({ allowUnconfirmed: true }), 3000);
}
