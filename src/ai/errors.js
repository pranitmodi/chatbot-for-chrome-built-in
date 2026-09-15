export const ERROR_CODE = {
  ABORTED: "aborted",
  CONTEXT_TOO_LARGE: "context_too_large",
  NOT_SUPPORTED: "not_supported",
  INVALID_STATE: "invalid_state",
  INVALID_INPUT: "invalid_input",
  PERMISSION_DENIED: "permission_denied",
  USER_ACTIVATION: "user_activation",
  TIMEOUT: "timeout",
  DOWNLOADING: "downloading",
  UNAVAILABLE: "unavailable",
  UNEXPECTED: "unexpected",
};

export function categorizeError(error) {
  if (!error) {
    return "The local model couldn't complete that request. Start a new chat and try again.";
  }
  if (error.name === "AbortError" || error.code === ERROR_CODE.ABORTED) {
    return null;
  }
  if (error.name === "QuotaExceededError" || error.code === ERROR_CODE.CONTEXT_TOO_LARGE) {
    return "This message is too large for the model's context window. Shorten it, start a new chat, or remove attachments.";
  }
  if (error.name === "NotSupportedError" || error.code === ERROR_CODE.NOT_SUPPORTED) {
    return "This input isn't supported in the current Chrome configuration. Check Local AI Status for available modalities.";
  }
  if (error.name === "InvalidStateError" || error.code === ERROR_CODE.INVALID_STATE) {
    return "The local AI session is no longer active. Start a new chat.";
  }
  if (error.name === "NotAllowedError" || error.code === ERROR_CODE.PERMISSION_DENIED) {
    return "Permission was denied. Allow camera, microphone, or page access when Chrome asks, then retry.";
  }
  if (error.code === ERROR_CODE.INVALID_INPUT) {
    return error.message || "That input isn't valid for Local AI.";
  }
  if (typeof error.message === "string" && /user activation/i.test(error.message)) {
    return "Chrome needs a click or key press before it can prepare the local model.";
  }
  if (error.name === "TimeoutError" || error.code === ERROR_CODE.TIMEOUT) {
    return "Chrome didn't finish checking the on-device model in time. Retry Prepare local AI on an unmetered connection.";
  }
  if (error.code === ERROR_CODE.DOWNLOADING) {
    return "The on-device model is still downloading. Wait until Local AI is ready, then retry.";
  }
  if (error.code === ERROR_CODE.UNAVAILABLE) {
    return "Built-in AI is not available on this device. Open Local AI Status for setup steps.";
  }
  return "The local model couldn't complete that request. Try again, or start a new chat if the session was interrupted.";
}
