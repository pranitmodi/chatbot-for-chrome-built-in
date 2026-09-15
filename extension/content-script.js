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
