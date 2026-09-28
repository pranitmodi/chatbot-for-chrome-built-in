import { isKnownView, VIEW_TITLES } from "./features/navigation.js";

const MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/;
const IDENTIFIER_PATTERN = /^[a-z0-9_-]{1,40}$/i;

const EVENT_NAMES = new Set([
  "page_view",
  "onboarding_complete",
  "model_prepare",
  "model_ready",
  "chat_message",
  "chat_stop",
  "chat_copy",
  "chat_save_note",
  "tool_run",
  "note_create",
  "memory_command",
  "data_export",
  "data_import",
  "app_install",
  "theme_change",
]);

const PARAM_RULES = {
  page_path: (value) => (typeof value === "string" && /^\/[a-z0-9-]+$/.test(value) ? value : undefined),
  page_title: (value) => (typeof value === "string" && /^[\w .'-]{1,40}$/.test(value) ? value : undefined),
  has_attachment: (value) => (typeof value === "boolean" ? value : undefined),
  attachment_count: (value) => (Number.isInteger(value) && value >= 0 && value <= 20 ? value : undefined),
  regenerated: (value) => (typeof value === "boolean" ? value : undefined),
  tool_id: (value) => (typeof value === "string" && IDENTIFIER_PATTERN.test(value) ? value : undefined),
  mode: (value) => (typeof value === "string" && IDENTIFIER_PATTERN.test(value) ? value : undefined),
  status: (value) => (value === "success" || value === "error" || value === "aborted" ? value : undefined),
  source: (value) => (value === "manual" || value === "chat" || value === "image" ? value : undefined),
  command: (value) => (
    value === "remember" || value === "forget" || value === "list" || value === "opt_out" ? value : undefined
  ),
  theme: (value) => (value === "light" || value === "dark" ? value : undefined),
};

let measurementId = "";
let enabledInTest = false;
let modelReadyTracked = false;

export function isValidMeasurementId(value) {
  return MEASUREMENT_ID_PATTERN.test(String(value || "").trim());
}

export function analyticsConfigured() {
  return isValidMeasurementId(import.meta.env.VITE_GA_MEASUREMENT_ID);
}

export function activateAnalytics(id) {
  const next = String(id || "").trim();
  if (!isValidMeasurementId(next)) {
    measurementId = "";
    return false;
  }
  measurementId = next;
  enabledInTest = true;
  return true;
}

export function initAnalytics() {
  if (import.meta.env.MODE === "test") return false;
  return activateAnalytics(import.meta.env.VITE_GA_MEASUREMENT_ID);
}

export function resetAnalytics() {
  measurementId = "";
  enabledInTest = false;
  modelReadyTracked = false;
  if (typeof document !== "undefined") {
    document.querySelectorAll("script[data-ga]").forEach((node) => node.remove());
  }
  if (typeof window !== "undefined") {
    delete window.gtag;
    delete window.dataLayer;
  }
}

export function trackPageView(view) {
  if (!isKnownView(view)) return false;
  return trackEvent("page_view", {
    page_path: `/${view}`,
    page_title: VIEW_TITLES[view] || "Local AI",
  });
}

export function trackModelReady() {
  if (modelReadyTracked) return false;
  const sent = trackEvent("model_ready");
  if (sent) modelReadyTracked = true;
  return sent;
}

export function trackEvent(name, params = {}) {
  if (!EVENT_NAMES.has(name) || !canSend()) return false;
  const safe = sanitizeParams(params);
  window.gtag("event", name, safe);
  return true;
}

function canSend() {
  if (!measurementId) return false;
  if (import.meta.env.MODE === "test" && !enabledInTest) return false;
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
  return installGtag(measurementId);
}

function installGtag(id) {
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== "function") {
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };
  }
  if (!document.querySelector("script[data-ga]")) {
    const script = document.createElement("script");
    script.async = true;
    script.dataset.ga = "true";
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    document.head.appendChild(script);
    window.gtag("js", new Date());
    window.gtag("config", id, { send_page_view: false });
  }
  return true;
}

function sanitizeParams(params) {
  const safe = {};
  for (const [key, rule] of Object.entries(PARAM_RULES)) {
    if (!Object.prototype.hasOwnProperty.call(params, key)) continue;
    const value = rule(params[key]);
    if (value !== undefined) safe[key] = value;
  }
  return safe;
}
