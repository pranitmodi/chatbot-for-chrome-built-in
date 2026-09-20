import { afterEach, describe, expect, it } from "vitest";
import {
  ONBOARDING_KEY,
  clearOnboarding,
  defaultLandingView,
  environmentReady,
  isOnboarded,
  markOnboarded,
  modelReady,
  onboardingStage,
  resumeAfterSetup,
} from "../features/onboarding.js";
import { parseHash } from "../features/navigation.js";

describe("onboarding stage", () => {
  it("maps Prompt API phases onto checklist steps", () => {
    expect(onboardingStage("checking")).toBe("checking");
    expect(onboardingStage("unsupported")).toBe("environment");
    expect(onboardingStage("unavailable")).toBe("environment");
    expect(onboardingStage("downloadable")).toBe("prepare");
    expect(onboardingStage("downloading")).toBe("prepare");
    expect(onboardingStage("error")).toBe("prepare");
    expect(onboardingStage("ready")).toBe("install");
  });

  it("treats checking and blocked phases as not environment-ready", () => {
    expect(environmentReady("checking")).toBe(false);
    expect(environmentReady("unsupported")).toBe(false);
    expect(environmentReady("downloadable")).toBe(true);
    expect(modelReady("ready")).toBe(true);
    expect(modelReady("downloadable")).toBe(false);
  });
});

describe("onboarding persistence", () => {
  afterEach(() => {
    clearOnboarding();
  });

  it("starts incomplete and remembers completion", () => {
    clearOnboarding();
    expect(isOnboarded()).toBe(false);
    expect(defaultLandingView(false)).toBe("setup");
    markOnboarded();
    expect(localStorage.getItem(ONBOARDING_KEY)).toBe("1");
    expect(isOnboarded()).toBe(true);
    expect(defaultLandingView(true)).toBe("home");
  });
});

describe("navigation landing", () => {
  afterEach(() => {
    window.location.hash = "";
  });

  it("defaults an empty hash to home, not chat", () => {
    window.location.hash = "";
    expect(parseHash().view).toBe("home");
  });

  it("uses setup as the first-run fallback", () => {
    window.location.hash = "";
    expect(parseHash("setup").view).toBe("setup");
  });

  it("preserves a requested extension handoff through setup", () => {
    const params = new URLSearchParams(
      "handoff=12345678&action=summarize&payload=page&autorun=1&setup=1",
    );
    const resume = resumeAfterSetup("page", params);
    expect(resume.target).toBe("page");
    expect(resume.params.get("handoff")).toBe("12345678");
    expect(resume.params.get("payload")).toBe("page");
    expect(resume.params.has("setup")).toBe(false);
  });
});
