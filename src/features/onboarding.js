export const ONBOARDING_KEY = "local-ai-onboarded";

export function isOnboarded() {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === "1";
  } catch {
    return false;
  }
}

export function markOnboarded() {
  try {
    localStorage.setItem(ONBOARDING_KEY, "1");
  } catch {
    // Private mode or blocked storage should not crash setup.
  }
}

export function clearOnboarding() {
  try {
    localStorage.removeItem(ONBOARDING_KEY);
  } catch {
    // ignore
  }
}

/** @typedef {"checking" | "environment" | "prepare" | "install"} OnboardingStage */

/**
 * Map Prompt API phase onto the first-run checklist.
 * Install stays visible after the model is ready so people can skip or install the PWA.
 * @param {string} phase
 * @returns {OnboardingStage}
 */
export function onboardingStage(phase) {
  if (phase === "checking") return "checking";
  if (phase === "unsupported" || phase === "unavailable") return "environment";
  if (phase === "ready") return "install";
  return "prepare";
}

export function environmentReady(phase) {
  return phase !== "unsupported" && phase !== "unavailable" && phase !== "checking";
}

export function modelReady(phase) {
  return phase === "ready";
}

export function defaultLandingView(onboarded) {
  return onboarded ? "home" : "setup";
}

/** Where to land once setup completes: back to the tool that was asked for, otherwise chat. */
export function resumeAfterSetup(view) {
  return ["setup", "home", "status"].includes(view) ? "chat" : view;
}
