const DEFAULT_APP_URL = "http://127.0.0.1:5173/";
const MAX_PAYLOAD = 7000;

export async function getAppUrl() {
  const stored = await chrome.storage.local.get("appUrl");
  return stored.appUrl || DEFAULT_APP_URL;
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

export async function openApp(view, payload, action) {
  const base = await getAppUrl();
  const params = new URLSearchParams();
  if (action) params.set("action", action);
  if (payload) params.set("payload", String(payload).slice(0, MAX_PAYLOAD));
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
