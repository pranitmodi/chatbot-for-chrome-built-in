const KEEP_RECENT = 8;

export function compactMessages(messages) {
  if (!messages || messages.length <= KEEP_RECENT + 2) {
    return { promptMessages: messages || [], summary: null };
  }
  const older = messages.slice(0, -KEEP_RECENT);
  const recent = messages.slice(-KEEP_RECENT);
  const summary = older
    .map((message) => `${message.role}: ${(message.text || message.content || "").slice(0, 180)}`)
    .join("\n")
    .slice(0, 1200);
  return {
    promptMessages: recent,
    summary: `[Conversation summary of earlier turns]\n${summary}`,
  };
}

export function messagesToInitialPrompts(systemPrompt, messages, summary) {
  const prompts = [{ role: "system", content: systemPrompt }];
  if (summary) {
    prompts.push({ role: "system", content: summary });
  }
  for (const message of messages || []) {
    const text = (message.text || message.content || "").trim();
    if (!text) continue;
    if (message.role !== "user" && message.role !== "assistant") continue;
    prompts.push({ role: message.role, content: text });
  }
  if (prompts.length === 1) return prompts;
  return prompts;
}
