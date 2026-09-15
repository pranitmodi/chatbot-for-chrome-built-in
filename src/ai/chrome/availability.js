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

export async function checkChromeAvailability() {
  if (!isLanguageModelSupported()) {
    return {
      status: AVAILABILITY.UNSUPPORTED,
      capabilities: emptyCapabilities(),
      sessionOptions: null,
    };
  }

  const dedicated = detectDedicatedApis();
  const imageInputs = [...TEXT_INPUTS, { type: "image" }];
  const imageStatus = await probeLanguageModelAvailability(imageInputs);
  const useImage = imageStatus !== AVAILABILITY.UNAVAILABLE;

  let baseStatus = imageStatus;
  let baseInputs = imageInputs;

  if (!useImage) {
    baseStatus = await probeLanguageModelAvailability(TEXT_INPUTS);
    baseInputs = TEXT_INPUTS;
  }

  if (baseStatus === AVAILABILITY.UNAVAILABLE) {
    return {
      status: AVAILABILITY.UNAVAILABLE,
      capabilities: {
        ...emptyCapabilities(),
        ...dedicated,
      },
      sessionOptions: null,
    };
  }

  const audioInputs = [...baseInputs, { type: "audio" }];
  let useAudio = false;
  let chosenStatus = baseStatus;
  let chosenInputs = baseInputs;

  try {
    const audioStatus = await probeLanguageModelAvailability(audioInputs);
    if (audioStatus !== AVAILABILITY.UNAVAILABLE) {
      useAudio = true;
      chosenStatus = audioStatus;
      chosenInputs = audioInputs;
    }
  } catch {
    useAudio = false;
  }

  return {
    status: chosenStatus,
    capabilities: {
      localModel: true,
      textInput: true,
      textOutput: true,
      imageInput: useImage,
      audioInput: useAudio,
      videoInput: useImage,
      streaming: true,
      summarization: dedicated.summarization,
      rewriting: dedicated.rewriting,
      proofreading: dedicated.proofreading,
      image: useImage,
      audio: useAudio,
      videoFrames: useImage,
    },
    sessionOptions: {
      expectedInputs: chosenInputs,
      expectedOutputs: TEXT_OUTPUTS,
    },
  };
}
