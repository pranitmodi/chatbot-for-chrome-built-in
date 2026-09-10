# Build a Free, Browser-Native AI Chatbot with Chrome's Built-in AI

## What you are building

Build a polished, production-quality chatbot website that uses Chrome's built-in AI model directly in the user's browser.

The goal is to make the project feel like a normal AI chatbot, while avoiding a traditional hosted LLM backend and API key.

A user should be able to open the website, check whether Chrome's built-in AI is available, start a conversation, and optionally attach an image or other supported visual input.

The core architecture is:

```text
User
  ↓
Static website
  ↓
Chrome's built-in Prompt API
  ↓
On-device language model
  ↓
Response rendered in the browser
```

Do not route chatbot prompts through our own server.

Do not require an OpenAI, Anthropic, Gemini API, or other hosted-model API key for the core experience.

The website can therefore be deployed as a static site, for example on GitHub Pages, Cloudflare Pages, Netlify, Vercel static hosting, or similar infrastructure.

---

# Important product positioning

Do not claim that the model is universally available to every Chrome user.

Chrome has built-in AI APIs, but availability depends on Chrome version, operating system, hardware, model availability, and rollout status. The underlying model is built into Chrome's AI stack, but the model may still need to be downloaded to the browser the first time a site uses it.

The application must detect support at runtime and explain the situation clearly.

Official Chrome documentation:

- AI in Chrome: https://developer.chrome.com/docs/ai
- Prompt API: https://developer.chrome.com/docs/ai/prompt-api
- Getting started: https://developer.chrome.com/docs/ai/get-started

---

# Core experience

Create a modern chatbot UI with:

- A clean landing/chat screen
- Conversation history
- User messages
- Assistant messages
- Streaming responses
- Markdown-friendly response rendering
- Stop-generation button
- New-chat button
- Clear model availability state
- Model download/preparation progress
- Image upload
- Image preview before sending
- Drag-and-drop image support
- Optional camera capture if practical
- Graceful handling of unsupported capabilities
- Mobile-responsive layout
- Dark/light mode if easy to support

The interface should feel like a real consumer AI product rather than a developer demo.

---

# Zero API key requirement

The core chatbot must not require users to:

- create an account
- enter an API key
- pay for an API
- configure environment variables
- run a backend server

A user should be able to clone the repository, deploy the static website, open it in a supported Chrome environment, and use the chatbot.

The user's own browser performs the inference.

---

# Chrome Prompt API

Use the current `LanguageModel` Prompt API.

The API is exposed as:

```js
LanguageModel
```

Do not use deprecated APIs such as:

```js
self.ai.languageModel
```

unless the current Chrome documentation explicitly requires it for a compatibility case.

The first thing the application should do is feature detection:

```js
if (!("LanguageModel" in self)) {
  // Built-in AI is not supported by this browser.
}
```

Then check actual model availability.

For a text chatbot:

```js
const availability = await LanguageModel.availability({
  expectedInputs: [
    {
      type: "text",
      languages: ["en"]
    }
  ],
  expectedOutputs: [
    {
      type: "text",
      languages: ["en"]
    }
  ]
});
```

For an image-capable chatbot, declare image input as well:

```js
const availability = await LanguageModel.availability({
  expectedInputs: [
    {
      type: "text",
      languages: ["en"]
    },
    {
      type: "image"
    }
  ],
  expectedOutputs: [
    {
      type: "text",
      languages: ["en"]
    }
  ]
});
```

Use the same expected input/output configuration when creating the session.

Chrome specifically recommends keeping the availability options aligned with the options used by the actual prompt/session because modality and language support can affect model availability.

---

# Availability states

Handle the browser's availability result.

Typical states include:

- `available`
- `downloadable`
- `downloading`
- `unavailable`

Do not treat all non-available states as errors.

### `available`

The model can be used immediately.

Show:

> AI ready

### `downloadable`

The device supports the model but the model needs to be downloaded.

Show:

> Prepare local AI

Explain that Chrome needs to download the model once.

Require meaningful user interaction before triggering the download/session creation when Chrome requires user activation.

### `downloading`

Show a progress UI.

For example:

> Preparing local AI… 64%

Do not make the user think the site has frozen.

### `unavailable`

Show:

> Chrome's built-in AI isn't available on this device yet.

Give a short explanation and link to setup requirements.

Do not silently fall back to a paid remote model.

---

# Create the model session

Create the session after the user has interacted with the page when required:

```js
const session = await LanguageModel.create({
  monitor(monitor) {
    monitor.addEventListener("downloadprogress", (event) => {
      // event.loaded represents download progress.
      updateDownloadProgress(event.loaded);
    });
  }
});
```

Use the current Chrome API shape from the official documentation if it changes.

Store the session for the current conversation.

When a conversation is discarded, clean it up:

```js
session.destroy();
```

Do not keep unused sessions alive indefinitely because they consume device resources.

---

# Text chat

For short answers:

```js
const result = await session.prompt("Explain recursion simply.");
```

For normal chatbot responses, prefer streaming:

```js
const stream = session.promptStreaming(userMessage);

let response = "";

for await (const chunk of stream) {
  response += chunk;
  renderAssistantChunk(chunk);
}
```

The UI should progressively display the response.

Do not wait for the complete response before showing anything.

---

# Conversation context

Use one session for a conversation so previous interactions are available as context.

Example:

```text
User:
Explain vector databases.

Assistant:
...

User:
Now explain it using a restaurant analogy.

Assistant:
...
```

The second prompt should retain the conversation context through the same session.

Add a "New chat" button that destroys the old session and creates a fresh one.

Do not attempt to manually serialize the entire conversation into every prompt unless there is a specific reason to do so.

---

# Multimodal chatbot

The chatbot should support image input where the Prompt API supports it.

The user should be able to:

1. Click an attachment button.
2. Select an image.
3. See a preview.
4. Add a text question.
5. Send both to the model.

Example interaction:

```text
[image of a restaurant menu]

"What are the vegetarian dishes on this menu?"
```

The Prompt API can accept structured content.

Conceptually:

```js
const response = await session.prompt([
  {
    role: "user",
    content: [
      {
        type: "text",
        value: "What is in this image?"
      },
      {
        type: "image",
        value: imageElement
      }
    ]
  }
]);
```

Use the exact currently supported input representation from Chrome's documentation.

Do not upload the image to our server.

Keep the image local to the browser.

---

# Video support

Do not pretend that a video file can necessarily be passed directly as a single Prompt API input.

Instead, if video analysis is supported by the current Chrome API, implement it by extracting representative frames from the video and passing supported image/canvas inputs to the model.

A possible architecture is:

```text
Video file
    ↓
HTML <video>
    ↓
Canvas frame extraction
    ↓
Representative frames
    ↓
Prompt API image inputs
    ↓
Local model
```

For example:

- Extract one frame every N seconds.
- Or sample a configurable maximum number of frames.
- Show the user how many frames will be analyzed.
- Keep all processing local.
- Avoid sending the original video to a backend.

Only implement this if the current Chrome Prompt API supports the required input path.

If video input is not supported by the user's environment, disable the feature and explain why.

---

# Audio support

If the current Chrome Prompt API supports audio input in the target environment, allow audio attachments.

Do not assume audio is universally available.

Feature-detect the capability and adapt the UI.

If audio is unsupported:

> Audio analysis isn't available in this Chrome configuration.

Never crash the application because one modality is unavailable.

---

# File handling

The default supported attachment should be images.

Accept common image formats such as:

- PNG
- JPEG
- WebP

Validate file size before processing.

Show:

- filename
- preview
- remove button

Do not persist private attachments unnecessarily.

Do not upload them to a backend.

---

# Security requirement

Treat model output as untrusted text.

Do NOT do this:

```js
output.innerHTML = modelResponse;
```

Instead use:

```js
output.textContent = modelResponse;
```

If Markdown rendering is required, use a trusted Markdown parser plus an HTML sanitizer.

Never allow model-generated HTML or scripts to execute.

This is especially important because the model output ultimately originates from an AI system and must not be treated as trusted application markup.

---

# UX states

Design explicit UI states for:

### Browser unsupported

```text
Built-in AI unavailable

This chatbot uses Chrome's built-in AI.
Open it in a supported Chrome desktop environment to continue.
```

### Model downloading

```text
Preparing local AI

Chrome is downloading the model needed for this chatbot.
This only needs to happen when the model isn't already available.
```

### Ready

```text
Local AI ready

Your messages are processed by Chrome's built-in AI on this device.
```

### Generating

```text
Thinking…
```

with a stop button.

### Error

Show the actual useful error category without exposing a giant technical stack trace.

---

# Important privacy positioning

The core design should be local-first.

When the built-in model is used:

- prompts are processed in the browser
- image inputs stay in the browser
- no AI API key is required
- the application does not need to send chat messages to an AI backend

Do not make absolute privacy claims beyond what the browser's current documentation supports.

Clearly distinguish:

> "This app doesn't send your prompts to our AI server"

from broader claims such as:

> "Nothing ever leaves your device"

The latter should only be claimed when it is technically guaranteed by the complete application and browser behavior.

---

# Performance

Optimize for local inference.

Requirements:

- Stream responses.
- Avoid unnecessary re-renders.
- Compress/resize very large images before passing them to the model when appropriate.
- Keep only the required conversation context.
- Destroy unused sessions.
- Avoid running multiple model sessions simultaneously unless necessary.
- Show download progress.
- Do not block the main UI thread unnecessarily.

---

# Model readiness

The model may not be ready immediately after opening the website.

The app should distinguish:

```text
Browser supports API
        ↓
Model available?
        ↓
No → Download model
        ↓
Yes
        ↓
Create session
        ↓
Chat
```

Do not show "AI ready" until a session can actually be created.

---

# Browser/device requirements

Build a compatibility panel that explains that built-in foundation-model APIs have hardware/platform requirements.

According to the current Chrome documentation, these APIs are intended for supported desktop environments such as:

- Windows 10/11
- macOS 13+
- Linux
- supported ChromeOS/Chromebook Plus configurations

The foundation-model APIs are not generally supported on Chrome mobile environments in the same way.

Do not hardcode a simplistic browser-version guarantee.

Runtime detection is the source of truth.

---

# Developer mode / local development

The application should work on localhost.

For local development, follow the current Chrome documentation for enabling/testing the built-in model.

Chrome documents local development through Chrome flags and the on-device internals page.

Useful diagnostics include:

```text
chrome://on-device-internals
```

and checking:

```js
await LanguageModel.availability();
```

Do not put instructions for experimental flags in the normal end-user experience.

Keep developer setup instructions in the README.

---

# Suggested project structure

Use a simple modern web stack.

For example:

```text
/
├── src/
│   ├── ai/
│   │   ├── languageModel.js
│   │   ├── availability.js
│   │   └── multimodal.js
│   ├── components/
│   │   ├── Chat.jsx
│   │   ├── Message.jsx
│   │   ├── Composer.jsx
│   │   ├── AttachmentPreview.jsx
│   │   └── ModelStatus.jsx
│   ├── App.jsx
│   └── main.jsx
├── public/
├── package.json
└── README.md
```

React + Vite is acceptable, but a framework is not mandatory.

If the implementation is simpler with vanilla JavaScript, use vanilla JavaScript.

Do not add dependencies just for the sake of adding dependencies.

---

# AI abstraction layer

Do not scatter `LanguageModel` calls throughout the UI.

Create a small abstraction:

```js
class LocalAI {
  constructor() {
    this.session = null;
  }

  async checkAvailability() {}

  async initialize() {}

  async prompt(text) {}

  async promptWithImage(text, image) {}

  async stream(text, onChunk) {}

  async destroy() {}
}
```

The UI should talk to this abstraction.

This makes the application easier to extend later.

---

# Optional fallback architecture

Do not add a remote AI fallback by default.

The goal of this project is to demonstrate that the chatbot can run with the browser's built-in model without an API key.

However, structure the code so a future provider could be added:

```text
AIProvider
├── ChromeLocalProvider
├── RemoteProvider (future)
└── OtherLocalProvider (future)
```

For this version, only implement:

```text
ChromeLocalProvider
```

If Chrome AI isn't available, show the compatibility screen instead of silently using another paid API.

---

# Chatbot personality

Make the chatbot capable but neutral.

System/instruction prompt should encourage:

- concise answers by default
- useful explanations
- admitting uncertainty
- not fabricating facts
- asking clarifying questions when needed
- explaining limitations around images/video
- avoiding unnecessary verbosity

Do not hardcode a fake claim that it is equivalent to every frontier model.

The value proposition is:

> A surprisingly capable AI chatbot that runs locally in the browser with no AI API key.

---

# Example capabilities to demonstrate

Include example starter prompts:

### Text

```text
Explain recursion like I'm 12.
```

### Image

```text
What's in this image?
```

### Screenshot

```text
Look at this screenshot and explain what is wrong with the UI.
```

### Document/photo

```text
Summarize the important information in this photo.
```

### Creative

```text
Turn this idea into a short story.
```

### Coding

```text
Explain this code and suggest a simpler implementation.
```

The exact capability should depend on what the current model supports.

---

# README requirements

The repository README should explain:

1. What the project is.
2. Why it doesn't need an AI API key.
3. How Chrome's built-in AI works.
4. Browser/device requirements.
5. How to run locally.
6. How to deploy.
7. How the Prompt API is called.
8. How model availability is detected.
9. How the model is initialized.
10. How streaming works.
11. How images are passed to the model.
12. How unsupported browsers are handled.
13. Privacy architecture.
14. Limitations.
15. Official Chrome documentation links.

Keep the README practical and copy-paste friendly.

---

# Acceptance criteria

The project is complete only if:

- [ ] It is a real working chatbot UI.
- [ ] It detects `LanguageModel` support.
- [ ] It checks model availability.
- [ ] It handles unavailable/downloadable/downloading/available states.
- [ ] It creates a Prompt API session.
- [ ] It supports streaming responses.
- [ ] It maintains multi-turn conversation context.
- [ ] It supports image input where available.
- [ ] It does not require an AI API key.
- [ ] It does not send chat prompts to our backend.
- [ ] It does not upload images to our backend.
- [ ] It safely renders model output.
- [ ] It handles errors gracefully.
- [ ] It destroys unused sessions.
- [ ] It works as a static web application.
- [ ] It clearly communicates browser/device limitations.
- [ ] The README contains setup and API examples.
- [ ] The implementation follows the latest official Chrome documentation rather than relying on stale examples.

---

# Most important instruction to the coding agent

Do not just create a mock chatbot UI.

Actually wire the application to Chrome's `LanguageModel` Prompt API.

Do not replace the model call with fake `setTimeout()` responses.

Do not call a remote AI API.

Do not hardcode "AI is available."

Build the real browser-native integration, feature-detect it, handle model preparation, stream responses, support multimodal input where available, and make the whole thing deployable as a static website.

The point of this project is to prove that a useful AI application can be shipped with the model execution happening directly inside the browser.

## Official references

- https://developer.chrome.com/docs/ai
- https://developer.chrome.com/docs/ai/prompt-api
- https://developer.chrome.com/docs/ai/get-started
