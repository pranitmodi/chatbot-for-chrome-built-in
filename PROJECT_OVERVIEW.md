# Local AI — Project Overview

## What this project is

Local AI is a private, local-first chatbot and productivity app built with React and Chrome's built-in Prompt API (`LanguageModel` / Gemini Nano).

The application has:

- no AI backend
- no API key
- no user account
- no hosted-model fallback
- no browser extension

When Chrome's local model is active, prompts and supported attachments are processed on the device.

```text
User
  → Local AI PWA
  → Chrome LanguageModel API
  → on-device Gemini Nano
  → streamed response
```

This is important because it demonstrates that a useful AI application can run without sending every conversation to a third-party AI server.

## The original problem

Most AI chat applications depend on:

- a permanent internet connection
- a remote inference server
- paid API credentials
- an account and cloud-side conversation history
- server infrastructure for scaling and security

This project takes a different approach. The website is the interface and orchestration layer, while Chrome supplies the model. Once the application shell and model are prepared, text chat can continue without the internet.

## What we built

### 1. Chrome built-in AI provider

All Chrome-specific AI access is isolated behind `ChromeLocalProvider` in `src/ai/provider.js`.

The provider is responsible for:

- detecting Prompt API support
- checking model and modality availability
- creating and destroying sessions
- streaming generated text
- stopping generation with `AbortController`
- running one-off prompts
- tracking context usage
- collecting basic performance diagnostics

React components do not call `LanguageModel` directly. This separation keeps browser-specific behavior in one layer and makes the UI easier to maintain and test.

### 2. Reliable capability detection

Chrome may support text, image, and audio differently on each machine. The app therefore probes:

- text input and text output
- text plus image input
- text plus image and audio input
- dedicated Summarizer, Rewriter, and Proofreader APIs

The app never assumes that a capability exists merely because the user is running Chrome.

The availability layer understands these states:

- `available`
- `downloadable`
- `downloading`
- `unavailable`
- unsupported API

Only a successfully created session is shown as ready.

### 3. Offline-first model selection

An important reliability issue was fixed in the capability selector.

Previously, a downloadable image or audio configuration could override a text model that was already installed. This could prevent ordinary text chat from starting offline while Chrome waited for an optional modality.

The app now:

1. probes text, image, and audio configurations independently
2. chooses the richest configuration that is already `available`
3. keeps an available text-only session when image or audio is merely downloadable
4. enables image, audio, and video-frame controls only when their selected configuration is ready

This makes text chat the dependable baseline instead of allowing optional features to block it.

### 4. Clear model-download behavior

The model is installed and managed by Chrome, not bundled with the website.

If the model has not been downloaded and the browser is offline, the app does not attempt an impossible download. It explains that the user must:

1. reconnect once
2. select **Prepare local AI**
3. wait for Chrome to finish downloading the model
4. return to offline use after preparation

Download progress is surfaced when Chrome provides it.

### 5. Progressive Web App and offline shell

The production build is an installable PWA.

Workbox precaches:

- HTML
- JavaScript
- CSS
- icons
- the web app manifest

The service worker:

- claims open clients after activation
- activates updated versions without waiting
- removes outdated caches
- serves `index.html` for application navigation

The application separately tracks:

- whether the browser reports a network connection
- whether a service worker controls the page
- whether the local model is ready
- whether a real local prompt succeeds

This distinction matters because `navigator.onLine` alone cannot prove that AI inference works offline.

### 6. Offline diagnostics

The Local AI Status screen reports:

- Prompt API presence
- current model phase
- text, image, audio, and streaming capabilities
- dedicated API availability
- app-shell cache state
- model readiness
- context usage
- session creation time
- time to first token
- generation duration

The offline test runs a real prompt and reports three independent facts:

1. whether the app shell is cached
2. whether local inference succeeded
3. whether the browser reports a network connection

The app only claims that inference succeeded when the prompt actually completes. It only describes the browser as offline when the browser reports no connection.

### 7. Streaming chat

Replies are streamed into the interface as Chrome generates them.

The streaming layer handles both formats seen across Chrome builds:

- cumulative snapshots, such as `Hel` followed by `Hello`
- deltas, such as `Hel` followed by `lo`

Users can stop generation, and a new chat destroys the old model session before creating another one.

### 8. Conversations and local storage

IndexedDB stores:

- conversations
- messages
- attachment blobs
- notes
- memories
- settings

Users can:

- restore conversations after a reload
- create a new chat
- rename, pin, duplicate, and delete conversations
- search local content
- export data as JSON
- import validated JSON
- remove orphaned attachment data

There is no account backend holding a second copy of this application data.

### 9. Local memory

The chatbot supports explicit memory commands, including:

- “Remember that…”
- “What do you remember about me?”
- “Forget that…”
- “Don't remember this conversation.”

Memory is intentionally conservative:

- secrets are rejected
- inferred memories require confirmation
- only a small number of relevant memories are retrieved
- the whole memory store is never inserted into every prompt
- memory can be reviewed and removed locally

This makes personalization useful without silently turning every conversation into permanent profile data.

### 10. Notes and local search

Useful results can be saved as local notes.

Search ranks local content using:

1. title matches
2. exact phrase matches
3. token overlap
4. recency

Search is debounced and does not require a hosted search service or remote vector database.

### 11. Focused AI tools

In addition to chat, the application provides:

- Analyze
- Explain
- Summarize
- Rewrite
- Proofread
- Extract
- Study
- Image analysis
- Notes
- Memory

These tools reuse the same local provider and centralized prompt builders. Analyze and Explain operate on text supplied inside the app; the project does not read other browser tabs.

### 12. Multimodal input

Where Chrome and the device support it, users can work with:

- image files
- camera captures
- audio files
- microphone recordings
- sampled video frames

Images are validated and resized locally. Video is not sent as a raw video stream; the app samples a limited number of frames and submits them as images.

Unsupported controls are disabled rather than pretending that a modality is available.

### 13. Context management

Chrome's local model has a finite context window.

The app:

- keeps multi-turn context in the active model session
- reports context usage when Chrome exposes it
- compacts older conversation turns for long chats
- avoids continually resending unnecessary history
- listens for context-overflow events

This reduces wasted local computation and helps conversations continue within model limits.

### 14. Prompt and output safety

Pasted content and attachments are treated as untrusted data.

Prompt builders clearly separate application instructions from user-provided content so text such as “ignore previous instructions” remains data rather than becoming a trusted command.

Generated Markdown is:

1. parsed with `marked`
2. sanitized with DOMPurify
3. rendered only after sanitization

Imported JSON is validated and user-provided files are never executed.

### 15. User experience

The application includes:

- first-run setup and compatibility guidance
- light and dark themes
- responsive sidebar navigation
- model and download status
- install prompt support
- local search
- attachment previews
- keyboard navigation
- `Ctrl/Cmd+Shift+Space` to open Chat

Unsupported devices receive actionable setup information instead of a broken chat screen.

## Architecture

```text
src/
  ai/
    provider.js             ChromeLocalProvider used by the UI
    capabilities.js         normalized capability helpers
    prompts.js              centralized task prompts
    errors.js               actionable error messages
    chrome/
      availability.js       API and modality probes
      session.js            session lifecycle
      streaming.js          streaming and cancellation
      multimodal.js         Prompt API media handling

  components/               React interface
  hooks/useLocalAi.js       model and connectivity state
  features/                 chat context, memory, drafts, navigation
  storage/                  IndexedDB repositories and import/export
  pwa/                      service-worker state helpers
  test/                     Vitest coverage
```

The main dependency direction is:

```text
React UI
  → useLocalAi
  → ChromeLocalProvider
  → Chrome Prompt API

React UI
  → storage repositories
  → IndexedDB
```

There is intentionally no remote AI provider.

## Technologies used

- React 19
- Vite 6
- Chrome Prompt API / `LanguageModel`
- IndexedDB
- `vite-plugin-pwa` and Workbox
- `marked`
- DOMPurify
- Lucide React
- Vitest
- jsdom
- fake-indexeddb

## Testing

The automated test suite covers:

- cumulative and delta streaming
- cancellation
- missing Prompt API behavior
- offline-safe model selection
- explicit memory commands
- sensitive-memory rejection
- relevant-memory retrieval
- untrusted pasted-content prompts
- conversation context compaction
- import validation
- IndexedDB persistence
- local search ranking
- onboarding and navigation behavior

The current suite contains 28 passing tests, and the production PWA build succeeds.

Browser-level offline verification remains a manual check:

1. build with `npm run build`
2. serve `dist/` over localhost or HTTPS
3. load the app once while online
4. prepare the Chrome model
5. confirm the service worker controls the page
6. disable the network
7. reopen the app and run the offline test

`npm run dev` is for development and does not represent the production offline cache.

## Privacy model

The project's privacy statement is intentionally precise:

> AI processing happens on your device when Local AI is active.

This means:

- the application has no AI server
- prompts are passed to Chrome's local Prompt API
- app data remains in the current browser profile
- attachments are processed with browser APIs
- export and import remain under user control

It does not claim that the browser itself never uses the network. Chrome may download models and has its own browser-level network behavior.

## Why this project is important

### Privacy

On-device inference reduces the need to send private writing, notes, images, and conversations to an external AI service.

### Offline access

After preparation, the chatbot remains useful during unreliable connectivity, travel, outages, or restricted-network situations.

### No recurring inference bill

There is no per-token application API charge and no backend inference service to operate.

### Simpler deployment

The app is static and can be deployed to ordinary static hosting. There are no server secrets, inference workers, or account databases to manage.

### User ownership

Conversations, notes, and memories live in the user's browser profile and can be exported as JSON.

### Honest capability handling

The product does not silently switch to a cloud model when local AI is unavailable. It explains what is missing and only enables capabilities that Chrome reports as ready.

### Practical local-AI engineering

The project goes beyond a basic Prompt API demo. It addresses session lifecycle, streaming differences, storage, context limits, multimodal capability checks, safe rendering, model download states, PWA caching, and real offline diagnostics.

## Current limitations

- A supported desktop version of Chrome is required.
- The machine must satisfy Chrome's hardware and storage requirements.
- The model must be downloaded before offline inference can work.
- A first visit requires a secure hosted page or localhost.
- `file://` pages cannot use the Prompt API.
- Mobile Chrome is generally unsupported.
- Image and audio depend on device-specific Chrome capabilities.
- Local-model quality may be lower than hosted frontier models.
- The context window is finite.
- Clearing browser site data can remove conversations, notes, memories, and the app cache.
- Chrome manages model storage separately and may require the model to be prepared again.
- The app does not browse the web or read other tabs.

## Final result

The completed project is a local-first AI application rather than a thin wrapper around a hosted chatbot API.

It combines:

- on-device generation
- a cacheable PWA interface
- robust offline text-chat selection
- local conversations, notes, and memory
- focused writing and study tools
- optional multimodal workflows
- transparent diagnostics
- careful privacy and safety boundaries

Its main value is not merely that it can generate text. Its value is that it shows how to build a useful AI product whose default architecture is private, offline-capable, transparent, and controlled by the user.
