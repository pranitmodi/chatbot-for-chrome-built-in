import { buildPagePayload, extractFromTab, openApp } from "./shared.js";

const MENUS = [
  { id: "explain", title: "Explain with Local AI", action: "explain" },
  { id: "summarize", title: "Summarize with Local AI", action: "summarize" },
  { id: "rewrite", title: "Rewrite with Local AI", action: "rewrite" },
  { id: "ask", title: "Ask Local AI", action: "ask" },
];

chrome.runtime.onInstalled.addListener(() => {
  for (const item of MENUS) {
    chrome.contextMenus.create({
      id: item.id,
      title: item.title,
      contexts: ["selection", "page"],
    });
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const menu = MENUS.find((item) => item.id === info.menuItemId);
  if (!menu || !tab?.id) return;

  const page = await extractFromTab(tab.id);
  const selection = info.selectionText || page?.selection || "";

  if (menu.action === "explain" && selection) {
    await openApp("explain", selection, "explain");
    return;
  }
  if (menu.action === "rewrite" && selection) {
    await openApp("rewrite", selection, "clearer");
    return;
  }

  const payload = selection || buildPagePayload(page);
  const action = menu.action === "ask" ? "ask" : "summarize";
  await openApp("page", payload, action);
});
