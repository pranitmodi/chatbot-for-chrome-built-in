import { afterEach, describe, expect, it, vi } from "vitest";
import { capabilityLabel } from "../ai/capabilities.js";
import {
  createDraft,
  draftFromCurrentRoute,
  readDraft,
} from "../features/drafts.js";

afterEach(() => {
  sessionStorage.clear();
  window.history.replaceState(null, "", "/");
});

describe("status language", () => {
  it("uses concise availability copy", () => {
    expect(capabilityLabel({ image: false }, "image")).toBe("Not available");
  });
});

describe("local drafts", () => {
  it("moves content between features without putting it in the URL", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "draft-12345678" });
    const id = createDraft("chat", "private result", "Notes");
    expect(readDraft("chat", id)).toMatchObject({
      content: "private result",
      source: "Notes",
    });
    window.history.replaceState(null, "", `/#/chat?draft=${id}`);
    expect(draftFromCurrentRoute("chat")?.content).toBe("private result");
    expect(window.location.hash).toBe(`#/chat?draft=${id}`);
    vi.unstubAllGlobals();
  });

  it("carries a draft into the analyze and explain tools", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "draft-87654321" });
    const id = createDraft("page", "pasted article", "Notes");
    window.history.replaceState(null, "", `/#/page?draft=${id}`);
    expect(draftFromCurrentRoute("page")?.content).toBe("pasted article");
    expect(draftFromCurrentRoute("explain")).toBe(null);
    vi.unstubAllGlobals();
  });
});
