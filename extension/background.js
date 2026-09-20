import {
  buildPagePayload,
  extractFromTab,
  getAppReadiness,
  isAppBlocked,
  openApp,
} from "./shared.js";

const MENUS = [
  { id: "explain", title: "Explain selection with Local AI", action: "explain", contexts: ["selection"] },
  { id: "rewrite", title: "Rewrite selection with Local AI", action: "rewrite", contexts: ["selection"] },
  { id: "summarize", title: "Summarize page with Local AI", action: "summarize", contexts: ["page"] },
  { id: "ask", title: "Ask Local AI about this page", action: "ask", contexts: ["page", "selection"] },
];

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.contextMenus.removeAll();
  for (const item of MENUS) {
    chrome.contextMenus.create({
      id: item.id,
      title: item.title,
      contexts: item.contexts,
    });
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "local-ai:app-status") return;
  const allowed = new Set([
    "checking",
    "unsupported",
    "unavailable",
    "downloadable",
    "downloading",
    "ready",
    "error",
    "unconfirmed",
  ]);
  if (!allowed.has(message.phase) || !message.origin) return;
  chrome.storage.local.set({
    appReadiness: {
      phase: message.phase,
      origin: String(message.origin),
      updatedAt: Number(message.updatedAt) || Date.now(),
    },
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const menu = MENUS.find((item) => item.id === info.menuItemId);
  if (!menu || !tab?.id) return;

  let page;
  try {
    page = await extractFromTab(tab.id);
  } catch {
    page = { title: tab.title || "", url: tab.url || "", text: "", selection: "", headings: [] };
  }
  const selection = info.selectionText || page?.selection || "";
  const readiness = await getAppReadiness();
  const setup = isAppBlocked(readiness);

  if (menu.action === "explain" && selection) {
    await openApp("explain", selection, "explain", { setup });
    return;
  }
  if (menu.action === "rewrite" && selection) {
    await openApp("rewrite", selection, "clearer", { setup });
    return;
  }

  const payload = selection || buildPagePayload(page);
  const action = menu.action === "ask" ? "ask" : "summarize";
  await openApp("page", payload, action, { setup });
});
