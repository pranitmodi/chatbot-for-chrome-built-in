# Local AI Chrome extension

Load this folder as an unpacked extension in `chrome://extensions` (Developer mode → Load unpacked).

The extension does **not** reimplement the Prompt API. It extracts the current page or selection in a content script, then opens the Local AI PWA/app with that text as untrusted data so inference stays in one place (full toolbox, session, streaming UI).

Default app URL: `http://127.0.0.1:5173/` (change it under **App URL** in the popup after you deploy).

## What “Summarize page” sends

From the active tab, the content script collects:

- **Title** — `document.title`
- **URL** — `location.href`
- **Headings** — up to 12 `h1`–`h3` from `article` / `main` / `[role=main]` when present
- **Selection** — highlighted text, if any
- **Main text** — visible body text after stripping nav, header, footer, scripts, cookie banners, etc. (capped ~12k chars in-page; handoff to the app is capped ~7k in the URL)

It does **not** send screenshots, cookies, passwords, or network traffic.

## Permissions

- Context menus and keyboard shortcut (`Ctrl/Cmd+Shift+Space` opens the popup)
- Active tab messaging for page extraction
- Optional host access if you inject the content script on a tab that was open before install

If this Chrome build cannot create `LanguageModel` inside an extension page, inference still happens in the installed PWA / HTTPS origin. The extension will not fake local inference.
