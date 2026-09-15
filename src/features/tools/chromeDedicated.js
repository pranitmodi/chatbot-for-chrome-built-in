async function maybeUseDedicatedApi(globalName, input, fallbackPrompt, provider, signal, onUpdate) {
  const globalObject = typeof self !== "undefined" ? self : globalThis;
  if (!(globalName in globalObject)) {
    return provider.streamText(fallbackPrompt, onUpdate, signal);
  }
  try {
    const Ctor = globalObject[globalName];
    if (typeof Ctor.availability === "function") {
      const status = await Ctor.availability();
      if (status === "unavailable") {
        return provider.streamText(fallbackPrompt, onUpdate, signal);
      }
    }
    const instance = await Ctor.create();
    const result = await instance.summarize?.(input) ||
      (await instance.rewrite?.(input)) ||
      (await instance.proofread?.(input)) ||
      (await instance.prompt?.(input));
    const text = typeof result === "string" ? result : result?.correctedInput || String(result || "");
    onUpdate(text);
    instance.destroy?.();
    return text;
  } catch {
    return provider.streamText(fallbackPrompt, onUpdate, signal);
  }
}

export async function runSummarizer(provider, text, fallbackPrompt, signal, onUpdate) {
  return maybeUseDedicatedApi("Summarizer", text, fallbackPrompt, provider, signal, onUpdate);
}

export async function runRewriter(provider, text, fallbackPrompt, signal, onUpdate) {
  return maybeUseDedicatedApi("Rewriter", text, fallbackPrompt, provider, signal, onUpdate);
}

export async function runProofreader(provider, text, fallbackPrompt, signal, onUpdate) {
  return maybeUseDedicatedApi("Proofreader", text, fallbackPrompt, provider, signal, onUpdate);
}
