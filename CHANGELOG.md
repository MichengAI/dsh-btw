# Changelog

## [Unreleased]

- Record manual end-to-end acceptance with Edge and a live DeepSeek model on `0.1.5-rc.1`: side questions, attachment rejection, copying, collapse/expand, cancellation, and continued parent-session operation. This is separate from `npm run test:compat`; the older three versions have not undergone browser end-to-end acceptance.
- Normalize lockfile download URLs to the official npm registry without changing package versions or integrity hashes.

- Support DSH `0.1.5-rc.1` unified attachments, rejecting images and files while retaining the legacy image-count protocol.
- Declare exact host peers `0.1.0-rc.8 || 0.1.1-rc.2 || 0.1.2-rc.1 || 0.1.5-rc.1` and update development dependencies and the lockfile to `0.1.5-rc.1`.
- Remove the standalone ui-chat injection requirement unavailable on older hosts while retaining conversation slot integration.
- Add `npm run test:compat`: artifacts built with the latest dependencies pass 43 tests on each of four isolated hosts, including real subagent forks, context isolation, disabled tools, cancellation, and continued parent-session operation, using a test model adapter.
- Run host tests against project dependencies by default instead of skipping when a local DSH installation is absent; cover attachment rejection and verify tool guards, RPC, and unload cleanup across the supported hosts.
- Use immutable absolute URLs for README images without adding image files to the npm package.
- Stop GitHub Release operations when the release list cannot be queried, and test creation, updates, and failure handling.
- Add React component tests for safe Markdown rendering, copying and retrying, collapse/expand, and closing.

## [0.1.4] - 2026-09-07

- Exclude repository-only screenshots and branding images from the published npm tarball, reducing the package size while keeping README images available on GitHub.
- Remove the standalone mock preview and its mock-only browser test so the repository no longer presents it as a real DSH plugin page.

## [0.1.3] - 2026-09-06

- Fix the package path in GitHub Actions so npm treats the tarball as a local file, and validate it with an npm publish dry run before publishing.
- Include the OIDC authorization check and its failure and credential-handling tests prepared for 0.1.2, whose publication failed before uploading a package.

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
