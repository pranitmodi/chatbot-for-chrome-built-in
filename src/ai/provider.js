import { AVAILABILITY, emptyCapabilities } from "./types.js";
import { SYSTEM_PROMPT } from "./systemPrompt.js";
import { checkChromeAvailability } from "./chrome/availability.js";
import { createLanguageModelSession, destroyLanguageModelSession } from "./chrome/session.js";
import { promptOnce, streamPrompt } from "./chrome/streaming.js";

/**
 * Chrome's built-in Prompt API provider. UI talks only to this class.
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
    this.diagnostics = {
      sessionCreateMs: null,
      timeToFirstTokenMs: null,
      generationMs: null,
      lastOutputChars: null,
    };
  }

  isSupported() {
    return typeof self !== "undefined" && "LanguageModel" in self;
  }

  /**
   * @returns {Promise<import("./types.js").AvailabilityResult>}
   */
  async availability() {
    const result = await checkChromeAvailability();
    this.lastAvailability = result;
    return result;
  }

  async checkAvailability() {
    return this.availability();
  }

  getCapabilities() {
    return this.lastAvailability?.capabilities ?? emptyCapabilities();
  }

  /**
   * @param {{ onDownloadProgress?: (loaded: number) => void, signal?: AbortSignal, initialPrompts?: unknown[], systemPrompt?: string }} [options]
   */
  async createSession(options = {}) {
    if (this.session) {
      return this.session;
    }
    if (this.createPromise) {
      return this.createPromise;
    }

    this.createPromise = this.#create(options);
    try {
      return await this.createPromise;
    } catch (error) {
      this.createPromise = null;
      throw error;
    }
  }

  async initialize(options = {}) {
    return this.createSession(options);
  }

  async #create(options = {}) {
    if (!this.lastAvailability?.sessionOptions) {
      const availability = await this.availability();
      if (
        availability.status === AVAILABILITY.UNSUPPORTED ||
        availability.status === AVAILABILITY.UNAVAILABLE ||
        !availability.sessionOptions
      ) {
        throw Object.assign(new Error("Built-in AI is not available."), {
          name: "NotSupportedError",
          code: "unavailable",
        });
      }
    }

    const { onDownloadProgress, signal, initialPrompts, systemPrompt } = options;
    const sessionOptions = this.lastAvailability.sessionOptions;
    const prompts = initialPrompts?.length
      ? initialPrompts
      : [{ role: "system", content: systemPrompt || SYSTEM_PROMPT }];

    const started = performance.now();
    const { session, overflowHandler } = await createLanguageModelSession({
      sessionOptions,
      initialPrompts: prompts,
      onDownloadProgress,
      signal,
      onContextOverflow: () => this.onContextOverflow?.(),
    });
    this.diagnostics.sessionCreateMs = Math.round(performance.now() - started);

    this.overflowHandler = overflowHandler;
    this.session = session;
    return session;
  }

  /**
   * @param {unknown} input
   * @param {(text: string) => void} onUpdate
   * @param {AbortSignal} [signal]
   */
  async streamText(input, onUpdate, signal) {
    if (!this.session) {
      throw Object.assign(new Error("The local AI session is not ready."), {
        name: "InvalidStateError",
      });
    }
    const started = performance.now();
    let first = true;
    const text = await streamPrompt(
      this.session,
      input,
      (next) => {
        if (first) {
          this.diagnostics.timeToFirstTokenMs = Math.round(performance.now() - started);
          first = false;
        }
        onUpdate(next);
      },
      signal,
    );
    this.diagnostics.generationMs = Math.round(performance.now() - started);
    this.diagnostics.lastOutputChars = text.length;
    return text;
  }

  async streamEphemeral(input, onUpdate, signal) {
    if (this.session?.clone) {
      const clone = await this.session.clone(signal ? { signal } : undefined);
      try {
        return await streamPrompt(clone, input, onUpdate, signal);
      } finally {
        try {
          clone.destroy();
        } catch {
          // already gone
        }
      }
    }
    await this.createSession();
    return this.streamText(input, onUpdate, signal);
  }

  async stream(input, onUpdate, signal) {
    return this.streamText(input, onUpdate, signal);
  }

  async prompt(input, signal) {
    if (!this.session) {
      throw Object.assign(new Error("The local AI session is not ready."), {
        name: "InvalidStateError",
      });
    }
    return promptOnce(this.session, input, signal);
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

  destroySession() {
    destroyLanguageModelSession(this.session, this.overflowHandler);
    this.session = null;
    this.createPromise = null;
    this.overflowHandler = null;
  }

  destroy() {
    this.destroySession();
  }
}

export function createProvider() {
  return new ChromeLocalProvider();
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
