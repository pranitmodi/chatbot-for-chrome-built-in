function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length > 1);
}

function scoreText(query, haystack, weight) {
  const q = query.trim().toLowerCase();
  const h = String(haystack || "").toLowerCase();
  if (!q || !h) return 0;
  if (h === q) return 100 * weight;
  if (h.includes(q)) return 40 * weight;
  const queryTokens = tokenize(q);
  const hayTokens = new Set(tokenize(h));
  if (!queryTokens.length) return 0;
  let overlap = 0;
  for (const token of queryTokens) {
    if (hayTokens.has(token)) overlap += 1;
  }
  return (overlap / queryTokens.length) * 12 * weight;
}

export function rankItems(query, items, getFields, recencyIso) {
  const q = query.trim();
  if (!q) return items;
  return items
    .map((item) => {
      const fields = getFields(item);
      let score = 0;
      score += scoreText(q, fields.title, 4);
      score += scoreText(q, fields.body, 1);
      if (recencyIso?.(item)) {
        const age = Date.now() - Date.parse(recencyIso(item));
        if (Number.isFinite(age) && age < 1000 * 60 * 60 * 24 * 14) {
          score += 2;
        }
      }
      return { item, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((row) => row.item);
}

export async function searchLocal(query) {
  const { listConversations } = await import("./conversations.js");
  const { listMessages } = await import("./messages.js");
  const { listNotes } = await import("./notes.js");
  const { listMemories } = await import("./memories.js");

  const conversations = await listConversations();
  const notes = await listNotes();
  const memories = await listMemories();
  const conversationHits = [];

  for (const conversation of conversations) {
    const messages = await listMessages(conversation.id);
    const body = messages.map((message) => message.content || "").join("\n");
    conversationHits.push({
      type: "conversation",
      id: conversation.id,
      title: conversation.title,
      snippet: body.slice(0, 180),
      updatedAt: conversation.updatedAt,
      titleText: conversation.title,
      bodyText: body,
    });
  }

  const noteHits = notes.map((note) => ({
    type: "note",
    id: note.id,
    title: note.title,
    snippet: String(note.content || "").slice(0, 180),
    updatedAt: note.updatedAt,
    titleText: note.title,
    bodyText: note.content,
  }));

  const memoryHits = memories.map((memory) => ({
    type: "memory",
    id: memory.id,
    title: memory.text,
    snippet: memory.category,
    updatedAt: memory.updatedAt,
    titleText: memory.text,
    bodyText: `${memory.category} ${memory.text}`,
  }));

  const combined = [...conversationHits, ...noteHits, ...memoryHits];
  return rankItems(
    query,
    combined,
    (item) => ({ title: item.titleText, body: item.bodyText }),
    (item) => item.updatedAt,
  );
}

export { tokenize };
