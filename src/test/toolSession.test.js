import { afterEach, describe, expect, it } from "vitest";
import {
  adoptToolDraft,
  rememberToolResult,
  resetToolSession,
  resultForTool,
  setSharedToolInput,
} from "../features/toolSession.js";

afterEach(() => {
  resetToolSession();
});

describe("shared tool input", () => {
  it("keeps one input and shows a result only for the tool that produced it", () => {
    setSharedToolInput("quarterly notes");
    rememberToolResult("summarize", "paragraph", "quarterly notes", "Three themes.");

    expect(resultForTool("summarize", "paragraph", "quarterly notes")).toBe("Three themes.");
    expect(resultForTool("proofread", "", "quarterly notes")).toBe("");
    expect(resultForTool("summarize", "bullets3", "quarterly notes")).toBe("");
  });

  it("hides a result when the input changes and restores it when the text matches again", () => {
    setSharedToolInput("quarterly notes");
    rememberToolResult("extract", "", "quarterly notes", "{\"items\":[]}");

    setSharedToolInput("quarterly notes, revised");
    expect(resultForTool("extract", "", "quarterly notes, revised")).toBe("");

    setSharedToolInput("quarterly notes");
    expect(resultForTool("extract", "", "quarterly notes")).toBe("{\"items\":[]}");
  });

  it("replaces the shared input when a draft is opened", () => {
    setSharedToolInput("original source");
    rememberToolResult("rewrite", "clearer", "original source", "Clearer source.");

    adoptToolDraft("Clearer source.", "Rewrite");
    expect(resultForTool("summarize", "paragraph", "Clearer source.")).toBe("");
    expect(resultForTool("rewrite", "clearer", "original source")).toBe("Clearer source.");
  });
});
