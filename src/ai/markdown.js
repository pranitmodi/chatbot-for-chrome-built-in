import DOMPurify from "dompurify";
import { marked } from "marked";

marked.setOptions({
  gfm: true,
  breaks: true,
});

const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "ul",
    "ol",
    "li",
    "code",
    "pre",
    "blockquote",
    "a",
    "h1",
    "h2",
    "h3",
    "h4",
    "hr",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "span",
  ],
  ALLOWED_ATTR: ["href", "title", "class", "target", "rel"],
  FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "img"],
  KEEP_CONTENT: true,
};

function isSafeHref(href) {
  return /^(https?:|mailto:)/i.test(href);
}

let purifyHooked = false;
if (typeof window !== "undefined" && !purifyHooked) {
  purifyHooked = true;
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A") {
      const href = node.getAttribute("href") || "";
      if (!isSafeHref(href)) {
        node.removeAttribute("href");
      } else {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      }
    }
  });
}

export function renderMarkdown(markdown) {
  const raw = marked.parse(markdown ?? "", { async: false });
  return DOMPurify.sanitize(raw, PURIFY_CONFIG);
}
