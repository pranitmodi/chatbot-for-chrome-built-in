import {
  AVAILABILITY,
  TEXT_INPUTS,
  TEXT_OUTPUTS,
  isLanguageModelSupported,
} from "./types.js";
import { SYSTEM_PROMPT } from "./systemPrompt.js";

function mergeStreamChunk(previous, chunk) {
  if (typeof chunk !== "string") {
    return previous;
  }
  if (!previous) {
    return chunk;
  }
  if (chunk.startsWith(previous)) {
    return chunk;
  }
  return previous + chunk;
}

function withTimeout(promise, ms, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(Object.assign(new Error(message), { name: "TimeoutError" }));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function probeAvailability(expectedInputs) {
  return withTimeout(
    LanguageModel.availability({
      expectedInputs,
      expectedOutputs: TEXT_OUTPUTS,
    }),
    12000,
    "Availability check timed out.",
  );
}

/**
 * Chrome's built-in Prompt API provider. The UI talks only to this class.
 */
export class ChromeLocalProvider {
  constructor() {
    this.session = null;
    /** @type {Promise<unknown> | null} */
    this.createPromise = null;
    /** @type {import("./types.js").AvailabilityResult | null} */
    this.lastAvailability = null;
    this.onContextOverflow = null;
    this.overflowHandler = null;
  }

  isSupported() {
    return isLanguageModelSupported();
  }

  /**
   * @returns {Promise<import("./types.js").AvailabilityResult>}
   */
  async checkAvailability() {
    if (!this.isSupported()) {
      const result = {
        status: AVAILABILITY.UNSUPPORTED,
        capabilities: { image: false, audio: false, videoFrames: false },
        sessionOptions: null,
      };
      this.lastAvailability = result;
      return result;
    }

    const imageInputs = [...TEXT_INPUTS, { type: "image" }];
    const imageStatus = await probeAvailability(imageInputs);
    const useImage = imageStatus !== AVAILABILITY.UNAVAILABLE;

    let baseStatus = imageStatus;
    let baseInputs = imageInputs;

    if (!useImage) {
      baseStatus = await probeAvailability(TEXT_INPUTS);
      baseInputs = TEXT_INPUTS;
    }

    if (baseStatus === AVAILABILITY.UNAVAILABLE) {
      const result = {
        status: AVAILABILITY.UNAVAILABLE,
        capabilities: { image: false, audio: false, videoFrames: false },
        sessionOptions: null,
      };
      this.lastAvailability = result;
      return result;
    }

    const audioInputs = [...baseInputs, { type: "audio" }];
    let useAudio = false;
    let chosenStatus = baseStatus;
    let chosenInputs = baseInputs;

    try {
      const audioStatus = await probeAvailability(audioInputs);
      if (audioStatus !== AVAILABILITY.UNAVAILABLE) {
        useAudio = true;
        chosenStatus = audioStatus;
        chosenInputs = audioInputs;
      }
    } catch {
      useAudio = false;
    }

    const result = {
      status: chosenStatus,
      capabilities: {
        image: useImage,
        audio: useAudio,
        videoFrames: useImage,
      },
      sessionOptions: {
        expectedInputs: chosenInputs,
        expectedOutputs: TEXT_OUTPUTS,
      },
    };
    this.lastAvailability = result;
    return result;
  }

  /**
   * @param {{ onDownloadProgress?: (loaded: number) => void, signal?: AbortSignal }} [options]
   */
  async initialize(options = {}) {
    if (this.session) {
      return this.session;
    }
    if (this.createPromise) {
      return this.createPromise;
    }

    this.createPromise = this.createSession(options);
    try {
      return await this.createPromise;
    } catch (error) {
      this.createPromise = null;
      throw error;
    }
  }

  async createSession(options = {}) {
    if (!this.lastAvailability?.sessionOptions) {
      const availability = await this.checkAvailability();
      if (
        availability.status === AVAILABILITY.UNSUPPORTED ||
        availability.status === AVAILABILITY.UNAVAILABLE ||
        !availability.sessionOptions
      ) {
        throw Object.assign(new Error("Built-in AI is not available."), {
          name: "NotSupportedError",
        });
      }
    }

    const { onDownloadProgress, signal } = options;
    const sessionOptions = this.lastAvailability.sessionOptions;

    const session = await LanguageModel.create({
      ...sessionOptions,
      initialPrompts: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
      ],
      signal,
      monitor(monitor) {
        monitor.addEventListener("downloadprogress", (event) => {
          onDownloadProgress?.(event.loaded);
        });
      },
    });

    this.overflowHandler = () => {
      this.onContextOverflow?.();
    };
    session.addEventListener("contextoverflow", this.overflowHandler);
    this.session = session;
    return session;
  }

  /**
   * @param {unknown} input
   * @param {(text: string) => void} onUpdate
   * @param {AbortSignal} [signal]
   */
  async stream(input, onUpdate, signal) {
    if (!this.session) {
      throw Object.assign(new Error("The local AI session is not ready."), {
        name: "InvalidStateError",
      });
    }

    const stream = this.session.promptStreaming(
      input,
      signal ? { signal } : undefined,
    );

    let text = "";
    for await (const chunk of stream) {
      text = mergeStreamChunk(text, chunk);
      onUpdate(text);
    }
    return text;
  }

  getContextUsage() {
    if (!this.session) {
      return null;
    }
    return {
      usage: this.session.contextUsage,
      window: this.session.contextWindow,
    };
  }

  destroy() {
    if (this.session && this.overflowHandler) {
      this.session.removeEventListener("contextoverflow", this.overflowHandler);
    }
    try {
      this.session?.destroy();
    } catch {
      // Session may already be gone.
    }
    this.session = null;
    this.createPromise = null;
    this.overflowHandler = null;
  }
}

/**
 * Build a Prompt API input from text plus local multimodal parts.
 * @param {string} text
 * @param {Array<{ type: "image" | "audio", value: unknown }>} media
 */
export function buildPromptInput(text, media = []) {
  const trimmed = text.trim();
  if (!media.length) {
    return trimmed;
  }

  const content = [];
  if (trimmed) {
    content.push({ type: "text", value: trimmed });
  } else {
    const hasAudio = media.some((part) => part.type === "audio");
    const imageCount = media.filter((part) => part.type === "image").length;
    if (hasAudio && imageCount === 0) {
      content.push({
        type: "text",
        value: "Transcribe or describe this audio.",
      });
    } else if (imageCount > 1) {
      content.push({
        type: "text",
        value: `These are ${imageCount} images or sampled video frames. Describe and analyze them.`,
      });
    } else {
      content.push({ type: "text", value: "What is in this image?" });
    }
  }

  for (const part of media) {
    content.push(part);
  }

  return [
    {
      role: "user",
      content,
    },
  ];
}

export function categorizeError(error) {
  if (!error) {
    return "Something went wrong.";
  }
  if (error.name === "AbortError") {
    return null;
  }
  if (error.name === "QuotaExceededError") {
    return "This message is too large for the model's context window.";
  }
  if (error.name === "NotSupportedError") {
    return "This input isn't supported in the current Chrome configuration.";
  }
  if (error.name === "InvalidStateError") {
    return "The local AI session is no longer active. Start a new chat.";
  }
  if (typeof error.message === "string" && /user activation/i.test(error.message)) {
    return "Chrome needs a click or key press before it can prepare the local model.";
  }
  if (error.name === "TimeoutError") {
    return "Chrome didn't finish checking the on-device model in time.";
  }
  return "The local model couldn't complete that request.";
}
