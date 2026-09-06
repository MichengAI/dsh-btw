# Changelog

## [Unreleased]

## [0.1.2] - 2026-09-06

- Add a GitHub Actions dry-run check that verifies the configured npm trusted publisher by exchanging an OIDC identity for a short-lived publishing credential without uploading a package.
- Add authorization failure and credential-handling tests for the release workflow. Plugin behavior is unchanged.

## [0.1.1] - 2026-09-06

- Limit each session to 20 side-question bubbles. At capacity, close the oldest completed bubble before accepting a new question; failed closure preserves answers and the current input with a localized message.
- Show localized retry messages when cleanup fails during closure and keep host error details in logs.
- Preserve completed answers when resource cleanup fails, with close retries still available.
- Bound startup cancellation and cleanup waits while retaining ownership of late child agents. Cleanup errors no longer block plugin unload, and unreleased children remain protected from tool execution.
- Retain recent bubbles per session so questions in another session cannot evict answers. Failed cleanup during eviction keeps the bubble available for retry.
- Format the community notice consistently as a blockquote in both READMEs.

## [0.1.0] - 2026-09-06

- Add one-shot `/btw` questions that inherit completed turns from the main session and answer without executing tools.
- Show independent Markdown answer bubbles above the composer, with copy, collapse, close, and cancellation cleanup.
- Support DSH light and dark themes and Chinese and English UI, while hiding internal transport commands.
- Leave the sidebar unchanged and do not record input history or bind arrow keys.
- Include installation instructions, real UI screenshots, and automated tests, packaging, and bilingual GitHub Releases.
- Provide complete English and Chinese READMEs and use the Apache-2.0 license consistently.
