import { afterEach, describe, expect, it } from "vitest";
import {
  activateAnalytics,
  initAnalytics,
  resetAnalytics,
  trackEvent,
  trackPageView,
} from "../analytics.js";

afterEach(() => {
  resetAnalytics();
});

function events() {
  return [...(window.dataLayer || [])]
    .filter((entry) => entry[0] === "event")
    .map((entry) => [entry[0], entry[1], { ...entry[2] }]);
}

describe("Google Analytics", () => {
  it("stays inactive in tests until a measurement id is supplied", () => {
    expect(initAnalytics()).toBe(false);
    expect(trackPageView("chat")).toBe(false);
    expect(document.querySelector("script[data-ga]")).toBeNull();
  });

  it("rejects a missing or malformed measurement id", () => {
    expect(activateAnalytics("")).toBe(false);
    expect(activateAnalytics("UA-123456")).toBe(false);
    trackEvent("theme_change", { theme: "dark" });
    expect(document.querySelector("script[data-ga]")).toBeNull();
  });

  it("loads the confirmed measurement id and records the route without its query string", () => {
    expect(activateAnalytics("G-1E3MDED43N")).toBe(true);
    expect(trackPageView("chat")).toBe(true);
    expect(trackPageView("not-a-view")).toBe(false);

    const script = document.querySelector("script[data-ga]");
    expect(script?.getAttribute("src")).toBe(
      "https://www.googletagmanager.com/gtag/js?id=G-1E3MDED43N",
    );
    expect(events()).toEqual([
      ["event", "page_view", { page_path: "/chat", page_title: "Chat" }],
    ]);
  });

  it("keeps prompts and unknown fields out of custom events", () => {
    activateAnalytics("G-1E3MDED43N");
    expect(trackEvent("chat_message", {
      has_attachment: true,
      attachment_count: 1,
      regenerated: false,
      text: "private prompt",
      filename: "secret.pdf",
    })).toBe(true);
    expect(trackEvent("typed_whatever", { text: "private prompt" })).toBe(false);

    expect(events()).toEqual([
      ["event", "chat_message", {
        has_attachment: true,
        attachment_count: 1,
        regenerated: false,
      }],
    ]);
  });

  it("does not load the tag while the browser is offline", () => {
    activateAnalytics("G-1E3MDED43N");
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
    try {
      expect(trackEvent("theme_change", { theme: "dark" })).toBe(false);
      expect(document.querySelector("script[data-ga]")).toBeNull();
    } finally {
      delete navigator.onLine;
    }
  });
});
