import { ToolWorkspace } from "./ToolWorkspace.jsx";
import { buildPagePrompt, buildSelectionPrompt } from "../ai/prompts.js";

export function PageAiView({ provider, phase, prepareModel, initialInput = "", sourceLabel }) {
  return (
    <ToolWorkspace
      title="Analyze text"
      description="Paste an article, transcript, or any long text. Modes keep the same text and only change the task."
      modes={[
        { id: "summarize", label: "Summarize" },
        { id: "explain", label: "Explain" },
        { id: "keyPoints", label: "Key points" },
        { id: "numbers", label: "Numbers" },
        { id: "arguments", label: "Challenge" },
        { id: "notes", label: "Notes" },
        { id: "ask", label: "Ask" },
      ]}
      defaultMode="summarize"
      placeholder="Paste the text you want to work on…"
      initialInput={initialInput}
      sourceLabel={sourceLabel}
      provider={provider}
      phase={phase}
      prepareModel={prepareModel}
      buildPrompt={(text, mode) =>
        buildPagePrompt(mode, { title: "Pasted text", url: "", text, headings: [] })
      }
    />
  );
}

export function ExplainView({ provider, phase, prepareModel, initialInput = "", sourceLabel }) {
  return (
    <ToolWorkspace
      title="Explain text"
      description="Paste a passage you want unpacked. Only the text you paste is used as context."
      modes={[
        { id: "explain", label: "Explain simply" },
        { id: "example", label: "With an example" },
        { id: "deeper", label: "Go deeper" },
        { id: "terms", label: "Technical terms" },
        { id: "context", label: "Context" },
        { id: "quiz", label: "Quiz me" },
        { id: "summarize", label: "Summarize" },
      ]}
      defaultMode="explain"
      placeholder="Paste the passage you want explained…"
      initialInput={initialInput}
      sourceLabel={sourceLabel}
      provider={provider}
      phase={phase}
      prepareModel={prepareModel}
      buildPrompt={(text, mode) => buildSelectionPrompt(mode, text)}
    />
  );
}
