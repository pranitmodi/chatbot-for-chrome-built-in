import { tokenize } from "../../storage/search.js";

export function retrieveMemories(query, memories, { topK = 5 } = {}) {
  const active = (memories || []).filter((item) => item.status === "active");
  if (!active.length) return [];
  const queryTokens = new Set(tokenize(query));
  const ranked = active
    .map((memory) => {
      const tokens = tokenize(`${memory.text} ${memory.category || ""}`);
      let overlap = 0;
      for (const token of tokens) {
        if (queryTokens.has(token)) overlap += 1;
      }
      let score = overlap;
      if (memory.source === "explicit") score += 2;
      if (memory.confidence === "high") score += 1.5;
      if (memory.confidence === "medium") score += 0.5;
      if (memory.lastUsedAt) score += 0.5;
      return { memory, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(8, Math.max(3, topK)));

  if (ranked.length) return ranked.map((row) => row.memory);

  return active
    .filter((item) => item.source === "explicit" && item.confidence === "high")
    .slice(0, 3);
}

export function resolveMemoryConflicts(memories) {
  const byKey = new Map();
  const sorted = [...memories].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  for (const memory of sorted) {
    const key = tokenize(memory.text).slice(0, 4).join(" ");
    if (!byKey.has(key)) byKey.set(key, memory);
  }
  return [...byKey.values()];
}
