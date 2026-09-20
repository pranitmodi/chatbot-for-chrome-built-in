import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const popupHtml = readFileSync(resolve(process.cwd(), "extension/popup.html"), "utf8");

function mockChrome(store) {
  return {
    storage: {
      local: {
        get: (key) => Promise.resolve(typeof key === "string" ? { [key]: store[key] } : store),
        set: (value) => {
          Object.assign(store, value);
          return Promise.resolve();
        },
      },
      onChanged: { addListener: () => {} },
    },
    tabs: {
      query: () => Promise.resolve([{ id: 1, title: "Example article", url: "https://example.com" }]),
      sendMessage: () =>
        Promise.resolve({
          title: "Example article",
          url: "https://example.com",
          text: "page text",
          selection: "",
          headings: [],
        }),
      create: () => Promise.resolve(),
    },
    scripting: { executeScript: () => Promise.resolve() },
    runtime: {},
  };
}

async function renderPopup(appReadiness) {
  document.documentElement.innerHTML = popupHtml;
  vi.stubGlobal(
    "chrome",
    mockChrome({ appUrl: "https://builtinchrome.project93.in/", appReadiness }),
  );
  vi.resetModules();
  await import("../../extension/popup.js");
  await vi.waitFor(() => {
    expect(document.getElementById("modelStatus").textContent).not.toBe("Checking Local AI…");
  });
}

const summarizeButton = () => document.querySelector('[data-action="summarize"]');
const modelStatus = () => document.getElementById("modelStatus");

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("extension popup readiness states", () => {
  it("confirms readiness and hides the setup call to action", async () => {
    await renderPopup({
      phase: "ready",
      origin: "https://builtinchrome.project93.in",
      updatedAt: Date.now(),
    });
    expect(modelStatus().textContent).toContain("Local AI ready");
    expect(document.getElementById("setupAction").hidden).toBe(true);
    expect(summarizeButton().disabled).toBe(false);
  });

  it("keeps actions usable when the deployment never reports status", async () => {
    await renderPopup({
      phase: "unconfirmed",
      origin: "https://builtinchrome.project93.in",
      updatedAt: Date.now(),
    });
    expect(modelStatus().textContent).toContain("doesn’t report status");
    expect(summarizeButton().disabled).toBe(false);
  });

  it("routes through setup only when the app reported it cannot answer", async () => {
    await renderPopup({
      phase: "unavailable",
      origin: "https://builtinchrome.project93.in",
      updatedAt: Date.now(),
    });
    expect(modelStatus().dataset.tone).toBe("warn");
    expect(document.getElementById("setupAction").hidden).toBe(false);
    expect(summarizeButton().disabled).toBe(true);
  });

  it("ignores readiness recorded for a different app location", async () => {
    await renderPopup({
      phase: "ready",
      origin: "http://localhost:5173",
      updatedAt: Date.now(),
    });
    expect(modelStatus().textContent).toContain("unknown");
    expect(summarizeButton().disabled).toBe(false);
  });
});
