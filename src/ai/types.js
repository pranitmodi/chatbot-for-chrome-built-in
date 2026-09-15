export const AVAILABILITY = {
  UNSUPPORTED: "unsupported",
  UNAVAILABLE: "unavailable",
  DOWNLOADABLE: "downloadable",
  DOWNLOADING: "downloading",
  AVAILABLE: "available",
};

export const TEXT_OUTPUTS = [{ type: "text", languages: ["en"] }];

export const TEXT_INPUTS = [{ type: "text", languages: ["en"] }];

export function isLanguageModelSupported() {
  return typeof self !== "undefined" && "LanguageModel" in self;
}

export function emptyCapabilities() {
  return {
    localModel: false,
    textInput: false,
    textOutput: false,
    imageInput: false,
    audioInput: false,
    videoInput: false,
    streaming: false,
    summarization: false,
    rewriting: false,
    proofreading: false,
    image: false,
    audio: false,
    videoFrames: false,
  };
}

/**
 * @typedef {Object} SessionOptions
 * @property {Array<{ type: string, languages?: string[] }>} expectedInputs
 * @property {Array<{ type: string, languages?: string[] }>} expectedOutputs
 */

/**
 * @typedef {Object} Capabilities
 * @property {boolean} localModel
 * @property {boolean} textInput
 * @property {boolean} textOutput
 * @property {boolean} imageInput
 * @property {boolean} audioInput
 * @property {boolean} videoInput
 * @property {boolean} streaming
 * @property {boolean} summarization
 * @property {boolean} rewriting
 * @property {boolean} proofreading
 * @property {boolean} image
 * @property {boolean} audio
 * @property {boolean} videoFrames
 */

/**
 * @typedef {Object} AvailabilityResult
 * @property {string} status
 * @property {Capabilities} capabilities
 * @property {SessionOptions | null} sessionOptions
 */

/**
 * @typedef {Object} AIProvider
 * @property {() => Promise<AvailabilityResult>} availability
 * @property {() => Promise<AvailabilityResult>} checkAvailability
 * @property {() => Capabilities | null} getCapabilities
 * @property {(options?: { onDownloadProgress?: (loaded: number) => void, signal?: AbortSignal, initialPrompts?: unknown[], systemPrompt?: string }) => Promise<unknown>} createSession
 * @property {(options?: { onDownloadProgress?: (loaded: number) => void, signal?: AbortSignal }) => Promise<unknown>} initialize
 * @property {(input: unknown, onUpdate: (text: string) => void, signal?: AbortSignal) => Promise<string>} streamText
 * @property {(input: unknown, onUpdate: (text: string) => void, signal?: AbortSignal) => Promise<string>} stream
 * @property {(input: unknown, signal?: AbortSignal) => Promise<string>} prompt
 * @property {() => void} destroySession
 * @property {() => void} destroy
 * @property {() => { usage: number, window: number } | null} getContextUsage
 */
