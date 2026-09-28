# Security Policy

## Supported versions

Security fixes are applied to the latest code on the `main` branch. This
project does not currently maintain separate release branches.

## Reporting a vulnerability

Please do not report suspected vulnerabilities in a public issue, discussion,
or pull request.

Use GitHub's private vulnerability reporting:

https://github.com/pranitmodi/chatbot-for-chrome-built-in/security/advisories/new

Include:

- the affected feature or file
- steps to reproduce the issue
- the security or privacy impact
- any suggested mitigation
- whether the issue has been disclosed elsewhere

You should receive an acknowledgement within seven days. The maintainer will
investigate, coordinate a fix and disclosure timeline when appropriate, and
credit reporters who want attribution.

## Project security model

Local AI is a static, local-first web application. It has no application
backend, user account system, or hosted AI provider. Prompts and supported
attachments are passed to Chrome's built-in on-device AI APIs when those APIs
are active. Conversations, notes, memories, settings, and attachment data are
stored in the current browser profile.

Local storage is not a cryptographic security boundary. Anyone with access to
the browser profile or local machine may be able to access that data. Chrome
also manages model downloads and browser-level networking independently of
this application.

Security-sensitive areas include:

- generated Markdown parsing and sanitization
- prompt construction around untrusted user content
- file, media, and JSON import validation
- IndexedDB storage and export/import
- service-worker and offline-cache behavior
- changes that introduce network requests or third-party services

Please also report inaccurate privacy claims or unexpected transmission of
user content as security issues.
