import { buildPagePayload, getAppUrl, openApp } from "./shared.js";

const statusEl = document.getElementById("status");
const pageMetaEl = document.getElementById("pageMeta");
const appUrlInput = document.getElementById("appUrl");

function setStatus(message, tone = "") {
  statusEl.textContent = message || "";
  statusEl.dataset.tone = tone;
  statusEl.hidden = !message;
}

async function currentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function extract() {
  const tab = await currentTab();
  if (!tab?.id) return null;
  try {
    return await chrome.tabs.sendMessage(tab.id, { type: "local-ai:extract" });
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content-script.js"],
      });
      return await chrome.tabs.sendMessage(tab.id, { type: "local-ai:extract" });
    } catch {
      return { title: tab.title || "", url: tab.url || "", text: "", selection: "", headings: [] };
    }
  }
}

function renderPageMeta(page) {
  if (!page) {
    pageMetaEl.hidden = true;
    return;
  }
  const chars = (page.text || "").length;
  const selection = (page.selection || "").length;
  pageMetaEl.hidden = false;
  pageMetaEl.innerHTML = `
    <strong>${escapeHtml(page.title || "This tab")}</strong>
    <span>${chars.toLocaleString()} chars of page text${page.truncated ? " (truncated)" : ""}${
      selection ? ` · ${selection.toLocaleString()} selected` : ""
    }</span>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function runAction(kind) {
  setStatus("Reading this tab…", "busy");
  const page = await extract();
  renderPageMeta(page);

  if (kind === "ask") {
    setStatus("Opening Local AI…", "busy");
    await openApp("chat");
    return;
  }
  if (kind === "notes") {
    setStatus("Opening notes…", "busy");
    await openApp("notes");
    return;
  }
  if (kind === "explain") {
    const selection = page?.selection || "";
    if (!selection) {
      setStatus("Select text on the page first.", "warn");
      return;
    }
    setStatus("Opening Explain in Local AI…", "busy");
    await openApp("explain", selection, "explain");
    return;
  }
  if (kind === "rewrite") {
    const selection = page?.selection || "";
    if (!selection) {
      setStatus("Select text on the page first.", "warn");
      return;
    }
    setStatus("Opening Rewrite in Local AI…", "busy");
    await openApp("rewrite", selection, "clearer");
    return;
  }
  if (kind === "summarize") {
    const payload = buildPagePayload(page);
    if (!payload.trim()) {
      setStatus("Couldn’t read page text on this tab.", "warn");
      return;
    }
    setStatus("Opening Summarize in Local AI…", "busy");
    await openApp("page", payload, "summarize");
  }
}

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", () => runAction(button.dataset.action));
});

getAppUrl().then((value) => {
  appUrlInput.value = value;
});

appUrlInput.addEventListener("change", () => {
  chrome.storage.local.set({ appUrl: appUrlInput.value.trim() });
  setStatus("App URL saved.", "ok");
});

extract().then(renderPageMeta).catch(() => {
  pageMetaEl.hidden = true;
});
