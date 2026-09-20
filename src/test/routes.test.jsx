import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import { App } from "../components/App.jsx";
import { VIEWS } from "../features/navigation.js";
import { clearOnboarding, markOnboarded } from "../features/onboarding.js";

/** Render App with availability still pending, which is the state on a cold load. */
async function renderAt(hash) {
  window.location.hash = hash;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<App />);
  });
  const text = container.querySelector("#main")?.textContent || "";
  await act(async () => {
    root.unmount();
  });
  container.remove();
  return text;
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("LanguageModel", {
    availability: () => new Promise(() => {}),
    create: () => new Promise(() => {}),
    params: () => new Promise(() => {}),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearOnboarding();
});

describe("no route renders a blank page while availability is being checked", () => {
  it("renders body content for every known view", async () => {
    markOnboarded();
    for (const { id } of VIEWS) {
      const text = await renderAt(`#/${id}`);
      expect(text.replace("Checking local AI…", "").trim().length, `view ${id}`).toBeGreaterThan(40);
    }
  });

  it("explains itself when chat opens before the model has been checked", async () => {
    markOnboarded();
    const text = await renderAt("#/chat");
    expect(text).toContain("Checking Chrome’s built-in AI");
  });

  it("falls back to home instead of an empty page on an unknown route", async () => {
    markOnboarded();
    const text = await renderAt("#/not-a-real-view");
    expect(text).toContain("What do you want to do?");
  });

  it("sends a first-time visitor to setup on an unknown route", async () => {
    const text = await renderAt("#/not-a-real-view");
    expect(text).toContain("Get Local AI ready on this device");
  });
});
