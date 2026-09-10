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

/**
 * @typedef {Object} SessionOptions
 * @property {Array<{ type: string, languages?: string[] }>} expectedInputs
 * @property {Array<{ type: string, languages?: string[] }>} expectedOutputs
 */

/**
 * @typedef {Object} AvailabilityResult
 * @property {string} status
 * @property {{ image: boolean, audio: boolean, videoFrames: boolean }} capabilities
 * @property {SessionOptions | null} sessionOptions
 */

/**
 * Provider interface implemented by ChromeLocalProvider.
 * Future RemoteProvider / OtherLocalProvider would share this shape.
 *
 * @typedef {Object} AIProvider
 * @property {() => Promise<AvailabilityResult>} checkAvailability
 * @property {(options?: { onDownloadProgress?: (loaded: number) => void, signal?: AbortSignal }) => Promise<unknown>} initialize
 * @property {(input: unknown, onUpdate: (text: string) => void, signal?: AbortSignal) => Promise<string>} stream
 * @property {() => void} destroy
 * @property {() => { usage: number, window: number } | null} getContextUsage
 */
