export function mergeStreamChunk(previous, chunk) {
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

function asAsyncIterable(stream) {
  if (stream && typeof stream[Symbol.asyncIterator] === "function") {
    return stream;
  }
  if (stream && typeof stream.getReader === "function") {
    return {
      async *[Symbol.asyncIterator]() {
        const reader = stream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            yield value;
          }
        } finally {
          reader.releaseLock();
        }
      },
    };
  }
  throw Object.assign(new Error("The local model did not return a stream."), {
    name: "InvalidStateError",
  });
}

export async function streamPrompt(session, input, onUpdate, signal) {
  const stream = session.promptStreaming(input, signal ? { signal } : undefined);
  let text = "";
  for await (const chunk of asAsyncIterable(stream)) {
    if (signal?.aborted) {
      throw Object.assign(new Error("Generation aborted"), { name: "AbortError" });
    }
    text = mergeStreamChunk(text, chunk);
    onUpdate(text);
  }
  return text;
}

export async function promptOnce(session, input, signal) {
  return session.prompt(input, signal ? { signal } : undefined);
}
