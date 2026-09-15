export { extractFromDocument as extractPage, extractSelection, pageToPlainText } from "./extractor.js";

export function hasSelection(text) {
  return Boolean(text && text.trim());
}
