# Contributing to Local AI

Thanks for helping improve Local AI. Contributions should preserve the
project's core promise: useful AI features that run through Chrome's built-in
on-device APIs without an account, API key, application backend, or silent
cloud fallback.

Please read the [Code of Conduct](CODE_OF_CONDUCT.md) and
[Security Policy](SECURITY.md) before contributing.

## Before opening an issue

- Search existing issues to avoid duplicates.
- Use the bug report form for reproducible defects.
- Use the feature request form for product proposals.
- Report vulnerabilities privately as described in `SECURITY.md`.
- Check Chrome's official built-in AI documentation when behavior may depend
  on the browser, operating system, hardware, or model availability.

## Development setup

Requirements:

- Node.js 20 or newer
- npm
- Chrome 148 or newer for manual Prompt API testing

Install dependencies and run the local development server:

```bash
npm ci
npm run dev
```

The UI can be developed in other browsers, but built-in AI behavior must be
verified in a supported Chrome desktop environment. Chrome's model is managed
by Chrome and is not included in this repository.

Before submitting a change, run:

```bash
npm test
npm run build
```

`npm run dev` does not exercise the production service worker or offline app
shell. Follow the manual production/offline steps in the README when changing
PWA, model preparation, or offline behavior.

## Architecture boundaries

- Keep Chrome-specific Prompt API access under `src/ai/chrome/`.
- UI components should use `ChromeLocalProvider` rather than calling
  `LanguageModel` directly.
- Keep capability detection centralized; never assume text, image, or audio
  support.
- Keep persistent data behind the repositories in `src/storage/`.
- Treat pasted content, attachments, imports, and generated Markdown as
  untrusted input.
- Do not add a backend, hosted-model fallback, account requirement, analytics,
  or API key without prior maintainer agreement.
- Do not make absolute privacy or offline claims. Chrome may download models
  and has browser-level network behavior outside this app.

See [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) for the current architecture and
[LOCAL_AI_CHROME_ROADMAP.md](LOCAL_AI_CHROME_ROADMAP.md) for product direction.

## Making changes

1. Fork the repository and create a focused branch from `main`.
2. Keep each pull request limited to one coherent change.
3. Follow the style of surrounding code. The project does not currently
   enforce an automatic formatter.
4. Add or update tests for changed behavior.
5. Update documentation when behavior, setup, compatibility, or privacy
   claims change.
6. Avoid committing generated output, local configuration, browser profile
   data, model files, or credentials.

For AI prompts, keep application instructions separate from user-provided
content and add tests for prompt-injection boundaries where relevant.

## Pull requests

Pull requests should explain:

- what changed and why
- how the change was tested
- which Chrome capabilities or platforms are affected
- any privacy, storage, accessibility, or offline implications
- screenshots for visible UI changes, when useful

Maintainers may ask for a smaller scope or additional tests. Opening a pull
request does not guarantee that a feature will be merged, especially when it
weakens the local-first architecture or depends on an unstable browser API.

By contributing, you agree that your contribution is licensed under the
[MIT License](LICENSE).
