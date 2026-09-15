import { SYSTEM_PROMPT } from "../systemPrompt.js";

export async function createLanguageModelSession({
  sessionOptions,
  initialPrompts,
  onDownloadProgress,
  signal,
  onContextOverflow,
}) {
  const prompts = initialPrompts?.length
    ? initialPrompts
    : [{ role: "system", content: SYSTEM_PROMPT }];

  const session = await LanguageModel.create({
    ...sessionOptions,
    initialPrompts: prompts,
    signal,
    monitor(monitor) {
      monitor.addEventListener("downloadprogress", (event) => {
        onDownloadProgress?.(event.loaded);
      });
    },
  });

  const overflowHandler = () => {
    onContextOverflow?.();
  };
  session.addEventListener("contextoverflow", overflowHandler);
  return { session, overflowHandler };
}

export function destroyLanguageModelSession(session, overflowHandler) {
  if (session && overflowHandler) {
    try {
      session.removeEventListener("contextoverflow", overflowHandler);
    } catch {
      // Session may already be gone.
    }
  }
  try {
    session?.destroy();
  } catch {
    // Session may already be gone.
  }
}
