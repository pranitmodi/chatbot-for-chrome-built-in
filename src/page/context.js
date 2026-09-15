import { extractFromDocument } from "./extractor.js";

const cache = new Map();

export function getPageContext(doc = document, options = {}) {
  const key = `${doc.URL || ""}:${options.selection || ""}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < 15000) {
    return cached.page;
  }
  const page = extractFromDocument(doc, options);
  cache.set(key, { page, at: Date.now() });
  return page;
}

export function clearPageContextCache() {
  cache.clear();
}
