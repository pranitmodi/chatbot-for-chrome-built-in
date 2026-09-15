const NOISE_SELECTORS = [
  "nav",
  "header",
  "footer",
  "aside",
  "script",
  "style",
  "noscript",
  "iframe",
  "form",
  "[role='navigation']",
  "[role='banner']",
  "[role='contentinfo']",
  "[aria-hidden='true']",
  ".cookie",
  ".cookies",
  "#cookie",
  ".ads",
  ".advertisement",
  "[class*='cookie']",
  "[id*='cookie']",
  "[class*='newsletter']",
];

const MAX_CHARS = 12000;

function visibleText(node) {
  if (!node) return "";
  const text = node.innerText || node.textContent || "";
  return text.replace(/\s+\n/g, "\n").replace(/[ \t]+/g, " ").trim();
}

export function extractFromDocument(doc = document, options = {}) {
  const documentRef = doc;
  const clone = documentRef.body ? documentRef.body.cloneNode(true) : null;
  if (clone) {
    for (const selector of NOISE_SELECTORS) {
      clone.querySelectorAll(selector).forEach((node) => node.remove());
    }
  }

  const article =
    clone?.querySelector("article, main, [role='main'], .post, .content") || clone;
  const headings = [...(article?.querySelectorAll("h1, h2, h3") || [])]
    .map((node) => (node.textContent || "").trim())
    .filter(Boolean)
    .slice(0, 20);

  const selection =
    options.selection ||
    documentRef.getSelection?.()?.toString()?.trim() ||
    "";

  let text = visibleText(article);
  let truncated = false;
  if (text.length > MAX_CHARS) {
    text = text.slice(0, MAX_CHARS);
    truncated = true;
  }

  return {
    title: documentRef.title || "",
    url: documentRef.URL || options.url || "",
    headings,
    selection,
    text,
    truncated,
    extractedAt: new Date().toISOString(),
  };
}

export function extractSelection(doc = document) {
  return doc.getSelection?.()?.toString()?.trim() || "";
}

export function pageToPlainText(page) {
  if (!page) return "";
  return [
    page.title,
    page.url,
    page.headings?.join("\n"),
    page.selection ? `Selection:\n${page.selection}` : "",
    page.text,
  ]
    .filter(Boolean)
    .join("\n\n");
}
