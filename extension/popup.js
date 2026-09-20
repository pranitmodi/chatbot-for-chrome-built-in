import {
  DEFAULT_APP_URL,
  buildPagePayload,
  canRunActions,
  getAppReadiness,
  getAppUrl,
  isAppBlocked,
  isAppReady,
  normalizeAppUrl,
  openApp,
} from "./shared.js";

const statusEl = document.getElementById("status");
const modelStatusEl = document.getElementById("modelStatus");
const pageMetaEl = document.getElementById("pageMeta");
const appUrlInput = document.getElementById("appUrl");
const setupAction = document.getElementById("setupAction");
let readiness = { phase: "unknown", updatedAt: 0 };
let currentPage = null;

function setStatus(message, tone = "") {
  statusEl.textContent = message || "";
  statusEl.dataset.tone = tone;
  statusEl.hidden = !message;
}

function readinessMessage() {
  if (isAppReady(readiness)) return "Local AI ready · actions run in the app";
  if (readiness.phase === "checking") return "The app is still checking Chrome’s model…";
  if (readiness.phase === "downloading") return "The app is preparing the on-device model…";
  if (readiness.phase === "downloadable") return "The model needs preparing once in the app";
  if (readiness.phase === "unsupported" || readiness.phase === "unavailable") {
    return "This Chrome can’t run Local AI · open setup for details";
  }
  if (readiness.phase === "error") return "The app couldn’t prepare the model · open setup";
  if (readiness.phase === "unconfirmed") {
    return "Your Local AI deployment doesn’t report status · actions still work";
  }
  return "Local AI status unknown · actions open the app anyway";
}

function renderReadiness() {
  const ready = isAppReady(readiness);
  const blocked = isAppBlocked(readiness);
  const usable = canRunActions(readiness);

  modelStatusEl.dataset.tone = ready ? "ok" : blocked ? "warn" : "";
  modelStatusEl.textContent = readinessMessage();
  setupAction.hidden = ready;

  document.querySelectorAll("[data-requires-ready]").forEach((button) => {
    const needsSelection = button.dataset.requiresSelection === "1";
    const missingSelection = needsSelection && !currentPage?.selection;
    button.disabled = !usable || missingSelection;
    if (!usable) button.title = "Open Local AI setup first";
    else if (missingSelection) button.title = "Select text on the page first";
    else button.removeAttribute("title");
  });
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
  if (kind === "setup") {
    setStatus("Opening Local AI setup…", "busy");
    await openApp("setup");
    return;
  }
  setStatus("Reading this tab…", "busy");
  const page = await extract();
  currentPage = page;
  renderPageMeta(page);
  renderReadiness();

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
    await openApp("explain", selection, "explain", { setup: isAppBlocked(readiness) });
    return;
  }
  if (kind === "rewrite") {
    const selection = page?.selection || "";
    if (!selection) {
      setStatus("Select text on the page first.", "warn");
      return;
    }
    setStatus("Opening Rewrite in Local AI…", "busy");
    await openApp("rewrite", selection, "clearer", { setup: isAppBlocked(readiness) });
    return;
  }
  if (kind === "summarize") {
    const payload = buildPagePayload(page);
    if (!payload.trim()) {
      setStatus("Couldn’t read page text on this tab.", "warn");
      return;
    }
    setStatus("Opening Summarize in Local AI…", "busy");
    await openApp("page", payload, "summarize", { setup: isAppBlocked(readiness) });
  }
}

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", () => runAction(button.dataset.action));
});

document.getElementById("saveAppUrl").addEventListener("click", async () => {
  try {
    const appUrl = normalizeAppUrl(appUrlInput.value);
    await chrome.storage.local.set({ appUrl, appReadiness: null });
    appUrlInput.value = appUrl;
    readiness = await getAppReadiness();
    renderReadiness();
    setStatus(`Saved. Actions now open ${new URL(appUrl).host}.`, "ok");
  } catch (error) {
    setStatus(error.message, "warn");
  }
});

document.getElementById("restoreAppUrl").addEventListener("click", async () => {
  await chrome.storage.local.set({ appUrl: DEFAULT_APP_URL, appReadiness: null });
  appUrlInput.value = DEFAULT_APP_URL;
  readiness = await getAppReadiness();
  renderReadiness();
  setStatus("Using the hosted Local AI app.", "ok");
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.appReadiness) return;
  getAppReadiness().then((next) => {
    readiness = next;
    renderReadiness();
  });
});

async function initialize() {
  const [appUrl, storedReadiness, page] = await Promise.all([
    getAppUrl(),
    getAppReadiness(),
    extract().catch(() => null),
  ]);
  appUrlInput.value = appUrl;
  readiness = storedReadiness;
  currentPage = page;
  renderPageMeta(page);
  renderReadiness();
}

initialize();
