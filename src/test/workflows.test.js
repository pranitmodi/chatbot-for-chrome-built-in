import { afterEach, describe, expect, it, vi } from "vitest";
import { capabilityLabel } from "../ai/capabilities.js";
import {
  consumeHandoff,
  handoffHasRun,
  markHandoffRun,
} from "../features/navigation.js";
import {
  createDraft,
  draftFromCurrentRoute,
  readDraft,
} from "../features/drafts.js";
import {
  DEFAULT_APP_URL,
  buildPagePayload,
  canRunActions,
  isAppBlocked,
  isAppReady,
  isAppUnconfirmed,
  normalizeAppUrl,
} from "../../extension/shared.js";

afterEach(() => {
  sessionStorage.clear();
  window.history.replaceState(null, "", "/");
});

describe("status language", () => {
  it("uses concise availability copy", () => {
    expect(capabilityLabel({ image: false }, "image")).toBe("Not available");
  });
});

describe("extension app URL", () => {
  it("defaults to the hosted app and normalizes secure URLs", () => {
    expect(DEFAULT_APP_URL).toBe("https://builtinchrome.project93.in/");
    expect(normalizeAppUrl("https://example.com/local-ai")).toBe(
      "https://example.com/local-ai/",
    );
    expect(normalizeAppUrl("http://localhost:5173")).toBe("http://localhost:5173/");
    expect(() => normalizeAppUrl("http://example.com")).toThrow(/HTTPS/);
  });

  it("bounds extracted page payloads", () => {
    const payload = buildPagePayload({
      title: "Example",
      url: "https://example.com",
      headings: ["Heading"],
      text: "x".repeat(9000),
    });
    expect(payload.length).toBeLessThanOrEqual(7000);
    expect(payload).toContain("Title: Example");
  });

  it("treats only the app's own ready phase as confirmed", () => {
    expect(isAppReady({ phase: "ready" })).toBe(true);
    expect(isAppReady({ phase: "available" })).toBe(false);
    expect(isAppReady({ phase: "unknown" })).toBe(false);
  });

  it("blocks actions only when the app reported it cannot answer", () => {
    expect(isAppBlocked({ phase: "unavailable" })).toBe(true);
    expect(isAppBlocked({ phase: "downloadable" })).toBe(true);
    expect(isAppBlocked({ phase: "unconfirmed" })).toBe(false);
    expect(isAppBlocked({ phase: "unknown" })).toBe(false);
  });

  it("keeps actions usable when a deployment never reports status", () => {
    expect(canRunActions({ phase: "unconfirmed" })).toBe(true);
    expect(canRunActions({ phase: "unknown" })).toBe(true);
    expect(canRunActions({ phase: "ready" })).toBe(true);
    expect(canRunActions({ phase: "unavailable" })).toBe(false);
    expect(isAppUnconfirmed({ phase: "unconfirmed" })).toBe(true);
    expect(isAppUnconfirmed({ phase: "ready" })).toBe(false);
  });
});

describe("extension handoff", () => {
  it("allowlists actions, stores content, and removes it from the visible fragment", () => {
    window.history.replaceState(
      null,
      "",
      "/#/page?handoff=12345678-abcd&action=summarize&payload=private%20page&autorun=1&setup=1",
    );
    const handoff = consumeHandoff("page");
    expect(handoff).toMatchObject({
      id: "12345678-abcd",
      action: "summarize",
      payload: "private page",
      autoRun: true,
    });
    expect(window.location.hash).toBe("#/page?handoff=12345678-abcd");
    expect(window.location.href).not.toContain("private");
  });

  it("tracks exactly-once auto-run claims", () => {
    expect(handoffHasRun("handoff-1")).toBe(false);
    markHandoffRun("handoff-1");
    expect(handoffHasRun("handoff-1")).toBe(true);
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
});
