export const DEFAULT_APP_URL = "https://builtinchrome.project93.in/";
const MAX_PAYLOAD = 7000;
const READY_MAX_AGE = 10 * 60 * 1000;

export function normalizeAppUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return DEFAULT_APP_URL;
  const url = new URL(raw);
  const loopback = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(loopback && url.protocol === "http:")) {
    throw new Error("Use an HTTPS URL, or HTTP only for localhost.");
  }
  url.hash = "";
  url.search = "";
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url.toString();
}

export async function getAppUrl() {
  const stored = await chrome.storage.local.get("appUrl");
  try {
    return normalizeAppUrl(stored.appUrl || DEFAULT_APP_URL);
  } catch {
    return DEFAULT_APP_URL;
  }
}

export async function getAppReadiness() {
  const [stored, appUrl] = await Promise.all([
    chrome.storage.local.get("appReadiness"),
    getAppUrl(),
  ]);
  const readiness = stored.appReadiness;
  const unknown = { phase: "unknown", origin: new URL(appUrl).origin, updatedAt: 0 };
  if (!readiness) return unknown;
  if (readiness.origin !== unknown.origin) return unknown;
  if (Date.now() - Number(readiness.updatedAt || 0) > READY_MAX_AGE) return unknown;
  return readiness;
}

export function isAppReady(readiness) {
  return readiness?.phase === "ready";
}

/** Phases where the app itself reported it cannot answer yet, so actions go through setup. */
const BLOCKED_PHASES = new Set([
  "checking",
  "unsupported",
  "unavailable",
  "downloadable",
  "downloading",
  "error",
]);

export function isAppBlocked(readiness) {
  return BLOCKED_PHASES.has(readiness?.phase);
}

/**
 * True when no phase was reported: the app was not opened recently, or that deployment
 * predates the readiness bridge. Actions still run, they just cannot be promised up front.
 */
export function isAppUnconfirmed(readiness) {
  return !isAppReady(readiness) && !isAppBlocked(readiness);
}

export function canRunActions(readiness) {
  return !isAppBlocked(readiness);
}

/** Structured handoff text for the Local AI app (title, URL, headings, body). */
export function buildPagePayload(page) {
  if (!page) return "";
  const parts = [];
  if (page.title) parts.push(`Title: ${page.title}`);
  if (page.url) parts.push(`URL: ${page.url}`);
  if (page.headings?.length) {
    parts.push(`Headings:\n${page.headings.slice(0, 12).join("\n")}`);
  }
  if (page.selection) parts.push(`Selection:\n${page.selection}`);
  if (page.text) parts.push(page.text);
  if (page.truncated) parts.push("[Page text truncated for length]");
  return parts.filter(Boolean).join("\n\n").slice(0, MAX_PAYLOAD);
}

export async function openApp(view, payload, action, options = {}) {
  const base = await getAppUrl();
  const params = new URLSearchParams();
  const handoff = crypto.randomUUID();
  params.set("handoff", handoff);
  if (action) params.set("action", action);
  if (payload) params.set("payload", String(payload).slice(0, MAX_PAYLOAD));
  if (payload && action) params.set("autorun", "1");
  if (options.setup) params.set("setup", "1");
  const url = `${base}#/${view}?${params.toString()}`;
  await chrome.tabs.create({ url });
}

export async function extractFromTab(tabId) {
  try {
    return await chrome.tabs.sendMessage(tabId, { type: "local-ai:extract" });
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content-script.js"],
    });
    return chrome.tabs.sendMessage(tabId, { type: "local-ai:extract" });
  }
}
