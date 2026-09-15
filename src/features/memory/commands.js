const SECRET_RE =
  /\b(password|passwd|api[_-]?key|secret|token|private key|credit card|ssn|social security)\b/i;

export function looksSensitive(text) {
  return SECRET_RE.test(text || "");
}

export function parseMemoryCommand(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;

  const rememberMatch = raw.match(/^(?:please\s+)?remember(?:\s+that)?\s+(.+)$/i);
  if (rememberMatch) {
    return { type: "remember", text: rememberMatch[1].trim() };
  }

  if (/^(what do you remember(?: about me)?|show (?:my )?memories)\??$/i.test(raw)) {
    return { type: "list" };
  }

  const forgetMatch = raw.match(/^(?:please\s+)?forget(?:\s+that)?\s+(.+)$/i);
  if (forgetMatch) {
    return { type: "forget", text: forgetMatch[1].trim() };
  }

  if (
    /don'?t remember (anything|this) (from )?this conversation/i.test(raw) ||
    /don'?t remember this conversation/i.test(raw)
  ) {
    return { type: "opt_out" };
  }

  return null;
}

export function inferMemoryCandidate(userText) {
  const text = String(userText || "").trim();
  if (text.length < 16 || looksSensitive(text)) return null;
  if (/^(hi|hello|hey|thanks|thank you)[.!]?$/i.test(text)) return null;
  const preference = text.match(/\b(i (?:prefer|like|use|want)|please (?:always|never) .+)$/i);
  if (preference && /prefer|always|never|don'?t use/i.test(text)) {
    return { text, category: "preference", confidence: "low" };
  }
  return null;
}
