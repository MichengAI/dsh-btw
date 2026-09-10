# Changelog

## [0.1.6] - 2026-09-11

- Support DSH `0.1.5-rc.2` while retaining compatibility with the four previously supported host versions.

## [0.1.5] - 2026-09-10

- Support DSH `0.1.5-rc.1`, while retaining compatibility with `0.1.0-rc.8`, `0.1.1-rc.2`, and `0.1.2-rc.1`.
- Adapt to the updated composer: side questions accept text only. Images or files prompt you to remove them while preserving your draft and attachments.

## [0.1.4] - 2026-09-07

- Reduce the installation package size; side-question behavior is unchanged.

## [0.1.3] - 2026-09-06

- Fix the package publishing failure; side-question behavior is unchanged.

## [0.1.2] - 2026-09-06

- Add a GitHub Actions dry-run check that verifies the configured npm trusted publisher by exchanging an OIDC identity for a short-lived publishing credential without uploading a package.
- Add authorization failure and credential-handling tests for the release workflow. Plugin behavior is unchanged.

## [0.1.1] - 2026-09-06

- Keep up to 20 side-question bubbles per session; questions in other sessions no longer remove your answers.
- Preserve existing answers and the current draft when closing fails, with a prompt to retry.
- Improve reliability when cancelling and closing side questions.

## [0.1.0] - 2026-09-06

- Introduce `/btw` side questions that use completed context from the main conversation and answer without executing tools.
- Display answers in separate bubbles above the composer, with Markdown, copy, collapse, close, and cancel support.
- Support light and dark themes and Chinese and English interfaces.
