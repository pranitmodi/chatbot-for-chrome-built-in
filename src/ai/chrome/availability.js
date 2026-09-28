import {
  AVAILABILITY,
  TEXT_INPUTS,
  TEXT_OUTPUTS,
  emptyCapabilities,
  isLanguageModelSupported,
} from "../types.js";

export function withTimeout(promise, ms, message) {
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

export async function probeLanguageModelAvailability(expectedInputs) {
  return withTimeout(
    LanguageModel.availability({
      expectedInputs,
      expectedOutputs: TEXT_OUTPUTS,
    }),
    12000,
    "Availability check timed out.",
  );
}

export function detectDedicatedApis() {
  const globalObject = typeof self !== "undefined" ? self : globalThis;
  return {
    summarization: "Summarizer" in globalObject,
    rewriting: "Rewriter" in globalObject,
    proofreading: "Proofreader" in globalObject,
  };
}

const IMAGE_INPUTS = [...TEXT_INPUTS, { type: "image" }];
const AUDIO_INPUTS = [...IMAGE_INPUTS, { type: "audio" }];

/**
 * Pick the richest modality set that is already installed.
 * A downloadable image or audio model must not turn an available text model into a download.
 * @param {{ textStatus: string, imageStatus: string, audioStatus: string }} probes
 */
export function selectAvailabilityPlan({ textStatus, imageStatus, audioStatus }) {
  const candidates = [
    { status: audioStatus, inputs: AUDIO_INPUTS, image: true, audio: true },
    { status: imageStatus, inputs: IMAGE_INPUTS, image: true, audio: false },
    { status: textStatus, inputs: TEXT_INPUTS, image: false, audio: false },
  ];
  const ready = candidates.find((item) => item.status === AVAILABILITY.AVAILABLE);
  if (ready) {
    return {
      status: AVAILABILITY.AVAILABLE,
      image: ready.image,
      audio: ready.audio,
      inputs: ready.inputs,
    };
  }

  if (textStatus === AVAILABILITY.DOWNLOADING || textStatus === AVAILABILITY.DOWNLOADABLE) {
    return {
      status: textStatus,
      image: false,
      audio: false,
      inputs: TEXT_INPUTS,
    };
  }

  return {
    status: AVAILABILITY.UNAVAILABLE,
    image: false,
    audio: false,
    inputs: null,
  };
}

function capabilitiesFor(plan, dedicated) {
  const ready = plan.status === AVAILABILITY.AVAILABLE;
  return {
    ...emptyCapabilities(),
    ...dedicated,
    localModel: ready,
    textInput: ready,
    textOutput: ready,
    imageInput: ready && plan.image,
    audioInput: ready && plan.audio,
    videoInput: ready && plan.image,
    streaming: ready,
    image: ready && plan.image,
    audio: ready && plan.audio,
    videoFrames: ready && plan.image,
  };
}

async function probeOptional(expectedInputs) {
  try {
    return await probeLanguageModelAvailability(expectedInputs);
  } catch {
    return AVAILABILITY.UNAVAILABLE;
  }
}

export async function checkChromeAvailability() {
  if (!isLanguageModelSupported()) {
    return {
      status: AVAILABILITY.UNSUPPORTED,
      capabilities: emptyCapabilities(),
      sessionOptions: null,
    };
  }

  const dedicated = detectDedicatedApis();
  const textStatus = await probeLanguageModelAvailability(TEXT_INPUTS);
  const imageStatus = await probeOptional(IMAGE_INPUTS);
  const audioStatus = await probeOptional(AUDIO_INPUTS);
  const plan = selectAvailabilityPlan({ textStatus, imageStatus, audioStatus });

  return {
    status: plan.status,
    capabilities: capabilitiesFor(plan, dedicated),
    sessionOptions: plan.inputs
      ? { expectedInputs: plan.inputs, expectedOutputs: TEXT_OUTPUTS }
      : null,
  };
}
