import { emptyCapabilities } from "./types.js";
import { detectDedicatedApis } from "./chrome/availability.js";

export { emptyCapabilities };

/**
 * Merge Prompt API modality probes with dedicated Chrome AI API feature detection.
 * Dedicated APIs are detected with `in self` only — never assumed present.
 */
export function buildCapabilities(modalities = {}) {
  const dedicated = detectDedicatedApis();
  const image = Boolean(modalities.image);
  const audio = Boolean(modalities.audio);
  return {
    ...emptyCapabilities(),
    localModel: Boolean(modalities.localModel),
    textInput: Boolean(modalities.textInput ?? modalities.localModel),
    textOutput: Boolean(modalities.textOutput ?? modalities.localModel),
    imageInput: image,
    audioInput: audio,
    videoInput: Boolean(modalities.videoFrames ?? image),
    streaming: Boolean(modalities.streaming ?? modalities.localModel),
    summarization: dedicated.summarization,
    rewriting: dedicated.rewriting,
    proofreading: dedicated.proofreading,
    image,
    audio,
    videoFrames: Boolean(modalities.videoFrames ?? image),
  };
}

export function capabilityLabel(capabilities, key) {
  if (!capabilities) return "Unknown";
  return capabilities[key] ? "Available" : "Not available on this device";
}
