const PREFIX = "local-ai-draft:";

export function createDraft(target, content, source = "Local AI") {
  const id = crypto.randomUUID();
  sessionStorage.setItem(
    `${PREFIX}${id}`,
    JSON.stringify({
      id,
      target,
      content: String(content || ""),
      source,
      createdAt: Date.now(),
    }),
  );
  return id;
}

export function openDraft(target, content, source) {
  const id = createDraft(target, content, source);
  window.location.hash = `#/${target}?draft=${encodeURIComponent(id)}`;
  return id;
}

export function readDraft(target, id) {
  if (!id) return null;
  try {
    const draft = JSON.parse(sessionStorage.getItem(`${PREFIX}${id}`) || "null");
    return draft?.target === target ? draft : null;
  } catch {
    return null;
  }
}

export function draftFromCurrentRoute(target) {
  const raw = window.location.hash.replace(/^#\/?/, "");
  const [, query = ""] = raw.split("?");
  return readDraft(target, new URLSearchParams(query).get("draft"));
}
