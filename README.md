# Built-in Chat

A static website that talks to **Chrome's built-in Prompt API** (`LanguageModel`) and runs the on-device model in the user's browser.

There is no AI backend, no OpenAI / Anthropic / Gemini API key, and no account. A user can open the site in a supported Chrome environment and chat.

This app doesn't send your prompts to our AI server. Images, audio, and sampled video frames stay in the browser for inference. Do not read that as "nothing ever leaves your device" — Chrome may still download the on-device model, and the browser itself has its own network behavior.

## Why there is no AI API key

The chatbot calls the Prompt API that ships with Chrome. The language model is part of Chrome's on-device AI stack (Gemini Nano). The website is only a UI plus a small JavaScript wrapper. Inference happens locally after the model is available in the browser.

## How Chrome's built-in AI works

```text
User
  → static website
  → LanguageModel Prompt API
  → on-device language model
  → streamed response in the page
```

Official documentation:

- [AI in Chrome](https://developer.chrome.com/docs/ai)
- [Prompt API](https://developer.chrome.com/docs/ai/prompt-api)
- [Getting started](https://developer.chrome.com/docs/ai/get-started)
- [Session management](https://developer.chrome.com/docs/ai/session-management)

The Prompt API is available on the web in **Chrome 148+** (desktop). Availability still depends on OS, hardware, disk space, and whether the model has been downloaded.

## Browser and device requirements

Runtime detection is the source of truth. The app never assumes the model is present.

Chrome currently documents foundation-model APIs for supported **desktop** environments such as:

- Windows 10 / 11
- macOS 13+
- Linux
- ChromeOS on Chromebook Plus (from the platform version listed in Chrome's docs)

They are **not** generally supported on Chrome for Android or iOS.

Chrome also documents hardware/storage constraints, including roughly **22 GB free** on the volume that holds the Chrome profile, and either a GPU with **more than 4 GB VRAM** or a CPU path with **16 GB RAM** and **4+ cores**. **Audio input requires a GPU.**

If the API is missing or `availability()` returns `unavailable`, the UI shows a compatibility panel instead of calling a paid remote model.

## Run locally

```bash
npm install
npm run dev
```

Open the printed localhost URL in Chrome.

The Prompt API works on `localhost`. If the model is not ready on your machine, Chrome's current getting-started guide covers flags and diagnostics (keep these out of the in-app user UI):

1. `chrome://flags/#optimization-guide-on-device-model` → Enabled
2. `chrome://flags/#prompt-api-for-gemini-nano` → Enabled or Enabled multilingual
3. Relaunch Chrome
4. Confirm in DevTools: `await LanguageModel.availability()`
5. Inspect model status at `chrome://on-device-internals`

## Deploy

This is a static site.

```bash
npm run build
```

Upload the `dist/` folder to GitHub Pages, Cloudflare Pages, Netlify, Vercel static hosting, or any other static file host.

The Vite `base` is `./`, so relative asset URLs work from a subdirectory as well as from a domain root.

The production build is a **Progressive Web App**. After you deploy it over **HTTPS**, Chrome desktop can install it (omnibox install icon, or **Install app** in the header when Chrome offers it). The installed app is still Chrome. That is how it keeps access to `LanguageModel`.

Install does **not** bundle Gemini Nano. It caches this chat UI. Chrome downloads the on-device model separately the first time the origin uses the Prompt API (unmetered network, enough disk). After both the PWA and the model are present, you can open the installed app and chat **without the internet**.

A first visit still needs the network to load or install the app. If the service worker is serving the shell offline but the Prompt API is missing or the model was never downloaded, the app shows the numbered setup steps — it does not fake "AI ready."

### Why a downloaded HTML file is not enough

The Prompt API only runs in a **secure context**: `https://` or `http://localhost`. A file you double-click is usually `file://`, which is **not** a secure context, so `LanguageModel` is unavailable.

An HTML file also cannot launch Chrome and attach to the built-in model. Wrapping the UI in Electron or a generic Mac `.app` would not get Gemini Nano either — that stack lives in Google Chrome.

There are no environment variables to configure.

## How model availability is detected

The app first feature-detects the API:

```js
if (!("LanguageModel" in self)) {
  // Built-in AI is not supported by this browser.
}
```

Then it calls `LanguageModel.availability()` with the **same** `expectedInputs` / `expectedOutputs` later passed to `LanguageModel.create()`. Chrome recommends keeping those options aligned because modality and language support can change availability.

Typical results:

| Status | What the UI does |
| --- | --- |
| `available` | Create a session, then show **Local AI ready** |
| `downloadable` | Show **Prepare local AI** and wait for a click (user activation) |
| `downloading` | Show **Preparing local AI… N%** from `downloadprogress` |
| `unavailable` | Show the compatibility screen |

"Local AI ready" is shown only after `LanguageModel.create()` succeeds.

Image and audio support are probed separately. If image input is unavailable, attachments that need images (including video frames) are disabled. If audio is unavailable, the UI explains that audio analysis isn't available in this Chrome configuration.

## How the model is initialized

After a user gesture when Chrome requires it, the app creates one session per conversation:

```js
const session = await LanguageModel.create({
  expectedInputs: [
    { type: "text", languages: ["en"] },
    { type: "image" }, // if supported
  ],
  expectedOutputs: [{ type: "text", languages: ["en"] }],
  initialPrompts: [{ role: "system", content: "…" }],
  monitor(monitor) {
    monitor.addEventListener("downloadprogress", (event) => {
      updateDownloadProgress(event.loaded);
    });
  },
});
```

**New chat** calls `session.destroy()` and creates a fresh session so unused sessions are not kept alive.

## How streaming works

Replies use `session.promptStreaming()`. The UI updates on each chunk instead of waiting for the full answer. Stop uses `AbortController` and passes `{ signal }` into `promptStreaming`.

```js
const stream = session.promptStreaming(userMessage, { signal });
let response = "";
for await (const chunk of stream) {
  response = chunk.startsWith(response) ? chunk : response + chunk;
  renderAssistant(response);
}
```

Some Chrome builds emit cumulative snapshots; others emit deltas. The client accepts both.

Multi-turn context lives on the session. The app does not reserialize the whole transcript into every prompt.

## How images (and other media) are passed

Nothing is uploaded to an application server.

Images (PNG, JPEG, WebP) are validated, resized in a canvas when large, previewed, and sent as Prompt API content:

```js
await session.prompt([
  {
    role: "user",
    content: [
      { type: "text", value: "What is in this image?" },
      { type: "image", value: imageBlob },
    ],
  },
]);
```

Video files are **not** sent as a single Prompt API video input. The app samples up to eight frames onto canvases and sends those as images, and tells the user how many frames will be analyzed.

Audio is attached only when availability for `{ type: "audio" }` is not `unavailable`.

## How unsupported browsers are handled

If `LanguageModel` is missing or availability is `unavailable`, chat is disabled and a numbered setup list walks through desktop Chrome, hardware, the one-time model download, and `chrome://on-device-internals`. There is no silent fallback to a hosted API. Experimental `chrome://flags` stay in this README for localhost, not in the in-app list.

## Privacy architecture

- Prompts go to Chrome's on-device Prompt API from this origin, not to a server we operate.
- Attachments are read with `File` / `Blob` APIs, resized locally, and revoked when removed or when the chat is reset.
- Conversations are not persisted to a backend. Refreshing the page starts over.
- The in-app claim is: **This app doesn't send your prompts to our AI server.** Broader claims such as "nothing ever leaves your device" are not used.

## Limitations

- Requires a supported Chrome desktop environment and a downloaded on-device model.
- Quality is that of Chrome's built-in model, not a hosted frontier model.
- Context is bounded by `session.contextWindow`. Overflow can drop older turns.
- Mobile Chrome is generally unsupported for this API.
- Markdown from the model is parsed and sanitized; it is treated as untrusted text.

## Project layout

```text
src/
  ai/
    types.js
    chromeLocal.js    # LanguageModel wrapper (the only Prompt API calls)
    multimodal.js
    markdown.js
    systemPrompt.js
  components/
    App.jsx
    Chat.jsx
    Message.jsx
    Composer.jsx
    AttachmentPreview.jsx
    ModelStatus.jsx
    CompatibilityPanel.jsx
    CameraCapture.jsx
    InstallApp.jsx
    AttachmentThumb.jsx
    ComposerToolButton.jsx
  pwa.js
  styles/index.css
  main.jsx
```

UI code talks to `ChromeLocalProvider` only. That class is the current `AIProvider` implementation; a remote provider is intentionally not included.
