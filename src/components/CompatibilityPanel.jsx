export function CompatibilityPanel({ phase }) {
  const unsupported = phase === "unsupported";

  return (
    <section className="compat" aria-live="polite">
      <h2>
        {unsupported
          ? "Built-in AI unavailable"
          : "Chrome's built-in AI isn't available on this device yet."}
      </h2>
      <p>
        This chatbot uses Chrome's built-in Prompt API and an on-device language model. Follow these
        steps in order. This app doesn't send your prompts to our AI server.
      </p>
      <ol className="setup-steps">
        <li>
          <strong>Open this page in desktop Google Chrome.</strong> Safari, Firefox, and Chrome
          on iOS or Android do not provide this API.
        </li>
        <li>
          <strong>Update Chrome</strong> to a current version. The Prompt API on the web needs Chrome
          148 or later.
        </li>
        <li>
          <strong>Check that this machine can host the model:</strong> Windows 10/11, macOS 13+,
          Linux, or a supported Chromebook Plus device; about 22 GB free on the Chrome profile disk;
          and either a GPU with more than 4 GB of VRAM, or 16 GB of RAM and 4 CPU cores.
        </li>
        <li>
          <strong>Use an unmetered network once</strong> so Chrome can download the on-device model.
          After that, chat can run offline. Installing this site as an app caches the UI, not the
          model.
        </li>
        <li>
          <strong>Come back here and choose Prepare local AI</strong> when Chrome reports the model
          as downloadable. That click is required before the download can start.
        </li>
        <li>
          <strong>If it still fails,</strong> open{" "}
          <code>chrome://on-device-internals</code>, check the Model Status tab, then retry this
          page.
        </li>
      </ol>
      {unsupported ? (
        <p>
          This browser does not expose <code>LanguageModel</code>. Switch to desktop Chrome and
          reload — installing the app will not add the model to Safari or another browser.
        </p>
      ) : (
        <p>
          Chrome is present, but this device or configuration cannot run the on-device model yet.
          Work through the steps above; do not expect a remote API fallback.
        </p>
      )}
      <p>
        Setup details:{" "}
        <a href="https://developer.chrome.com/docs/ai/get-started" target="_blank" rel="noreferrer">
          Chrome built-in AI getting started
        </a>
        {" · "}
        <a href="https://developer.chrome.com/docs/ai/prompt-api" target="_blank" rel="noreferrer">
          Prompt API
        </a>
      </p>
    </section>
  );
}
