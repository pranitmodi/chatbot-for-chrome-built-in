# What we built: Local AI

This note is a recap of the project. For setup, see [README.md](README.md). The original chatbot spec is [chrome-built-in-ai-chatbot-agent.md](chrome-built-in-ai-chatbot-agent.md). The product roadmap is [LOCAL_AI_CHROME_ROADMAP.md](LOCAL_AI_CHROME_ROADMAP.md).

**Repo:** https://github.com/pranitmodi/chatbot-for-chrome-built-in

---

## Goal

A **private AI layer for Chrome** that runs on the device: chat, memory, notes, and pasted-text tools. No API key, no account, no cloud inference.

```text
User → static PWA → Chrome LanguageModel Prompt API → on-device Gemini Nano → streamed reply
```

## What shipped

### Phase 1 — Foundation
- AI access split into `src/ai/provider.js` and `src/ai/chrome/{availability,session,streaming}.js`
- Central capabilities (text/image/audio/streaming plus feature-detected Summarizer/Rewriter/Proofreader)
- IndexedDB for conversations, messages, attachment Blobs, notes, memories, settings
- Restore chats after reload; rename, delete, duplicate, pin; JSON export/import
- Vitest coverage for availability, streaming merge/abort, persistence, import validation

### Phase 2 — Memory
- Explicit commands: remember / forget / what do you remember / don't remember this conversation
- Sparse inferred suggestions (Save / Not now)
- Keyword retrieval of a few relevant memories; never inject the whole store
- Settings UI; secrets are not stored

### Phase 3 — Pasted text
- Local text cleaning (noise stripping, truncation, untrusted-data prompts)
- Analyze and Explain work on text pasted into the page
- In-page shortcut: `Ctrl/Cmd+Shift+Space` opens Chat

### Phase 4 — Toolbox
- Home actions: summarize, rewrite, proofread, extract, study, notes
- Prompt builders in `src/ai/prompts.js`
- Proofreader/Rewriter/Summarizer used only if `in self`

### Phase 5 — Multimodal workflows
- Existing attach/camera/mic/video-frames preserved
- Image tool actions; no-image-no-send guard kept

### Phase 6 — Offline and diagnostics
- Privacy panel and Local AI Status
- Test Offline Mode runs a real local prompt, not only `navigator.onLine`
- Session create / TTFT / duration shown as N/A when unknown

### Phase 7 — Polish
- Context compaction for long chats
- Local search (title → phrase → tokens → recency), debounced
- Orphan attachment cleanup
- Sidebar navigation, keyboard shortcut, documentation

## Honest limits

- A `file://` HTML file cannot use `LanguageModel`
- PWA install caches the UI, not Gemini Nano
- Analyze and Explain use text you paste into this page
- No backend and no remote model fallback
