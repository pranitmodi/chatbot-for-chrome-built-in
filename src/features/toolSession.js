import { useEffect, useState } from "react";

const listeners = new Set();

function emptySession() {
  return {
    input: "",
    sourceLabel: "",
    labeledInput: "",
    modes: {},
    results: {},
  };
}

let state = emptySession();

function publish(next) {
  state = next;
  listeners.forEach((listener) => listener(state));
}

export function getToolSession() {
  return state;
}

export function resetToolSession() {
  publish(emptySession());
}

export function subscribeToolSession(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setSharedToolInput(input) {
  const text = String(input ?? "");
  const sameLabel = text === state.labeledInput;
  publish({
    ...state,
    input: text,
    sourceLabel: sameLabel ? state.sourceLabel : "",
    labeledInput: sameLabel ? state.labeledInput : "",
  });
}

export function adoptToolDraft(content, source = "") {
  const text = String(content ?? "");
  publish({
    ...state,
    input: text,
    sourceLabel: source || "",
    labeledInput: text,
  });
}

export function setToolMode(toolId, mode) {
  publish({
    ...state,
    modes: { ...state.modes, [toolId]: mode || "" },
  });
}

export function getToolMode(toolId) {
  return state.modes[toolId] || "";
}

export function rememberToolResult(toolId, mode, input, output) {
  const key = mode || "";
  const current = state.results[toolId] || {};
  publish({
    ...state,
    results: {
      ...state.results,
      [toolId]: {
        ...current,
        [key]: { input, output: String(output ?? "") },
      },
    },
  });
}

export function resultForTool(toolId, mode, input) {
  const saved = state.results[toolId]?.[mode || ""];
  if (!saved || saved.input !== input) return "";
  return saved.output;
}

export function useToolSession(draft) {
  const [session, setSession] = useState(() => {
    if (draft?.content) adoptToolDraft(draft.content, draft.source || "");
    return getToolSession();
  });

  useEffect(() => subscribeToolSession(setSession), []);
  return session;
}
