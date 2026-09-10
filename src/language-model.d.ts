type LanguageModelAvailability =
  | "available"
  | "downloadable"
  | "downloading"
  | "unavailable";

interface LanguageModelExpectedModality {
  type: "text" | "image" | "audio";
  languages?: string[];
}

interface LanguageModelCreateOptions {
  expectedInputs?: LanguageModelExpectedModality[];
  expectedOutputs?: LanguageModelExpectedModality[];
  initialPrompts?: Array<{
    role: "system" | "user" | "assistant";
    content: unknown;
    prefix?: boolean;
  }>;
  signal?: AbortSignal;
  monitor?: (monitor: EventTarget) => void;
}

interface LanguageModelPromptOptions {
  signal?: AbortSignal;
  responseConstraint?: unknown;
  omitResponseConstraintInput?: boolean;
}

type LanguageModelPromptInput =
  | string
  | Array<{
      role: "system" | "user" | "assistant";
      content:
        | string
        | Array<{
            type: "text" | "image" | "audio";
            value: unknown;
          }>;
      prefix?: boolean;
    }>;

interface LanguageModelSession extends EventTarget {
  prompt(
    input: LanguageModelPromptInput,
    options?: LanguageModelPromptOptions,
  ): Promise<string>;
  promptStreaming(
    input: LanguageModelPromptInput,
    options?: LanguageModelPromptOptions,
  ): ReadableStream<string> | AsyncIterable<string>;
  append(input: LanguageModelPromptInput): Promise<void>;
  clone(options?: { signal?: AbortSignal }): Promise<LanguageModelSession>;
  destroy(): void;
  contextUsage: number;
  contextWindow: number;
}

interface LanguageModelConstructor {
  availability(
    options?: LanguageModelCreateOptions,
  ): Promise<LanguageModelAvailability>;
  create(options?: LanguageModelCreateOptions): Promise<LanguageModelSession>;
}

declare var LanguageModel: LanguageModelConstructor;

interface Navigator {
  userActivation?: { isActive: boolean };
}
