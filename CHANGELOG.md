# Changelog

## [0.1.13] - 2026-09-25

- Support DSH `0.1.7-rc.2` and keep `0.1.7-rc.1` working. Supported hosts are `0.1.0-rc.8`, `0.1.1-rc.2`, `0.1.2-rc.1`, `0.1.5-rc.1`, `0.1.5-rc.2`, `0.1.7-rc.1`, and `0.1.7-rc.2`.

## [0.1.12] - 2026-09-24

- Support DSH `0.1.7-rc.1` and drop alpha host versions from the compatibility list. The remaining supported hosts are `0.1.0-rc.8`, `0.1.1-rc.2`, `0.1.2-rc.1`, `0.1.5-rc.1`, `0.1.5-rc.2`, and `0.1.7-rc.1`.

## [0.1.11] - 2026-09-22

- Support DSH `0.1.7-alpha.1` while retaining compatibility with the seven previously supported host versions.

## [0.1.10] - 2026-09-18

- List `/btw` in the official command catalog with a label, description, and icon.
- Keep independent bubbles when submitting from the official catalog; side questions still do not run tools.

## [0.1.9] - 2026-09-18

- Support DSH `0.1.6-alpha.2` while retaining compatibility with the six previously supported host versions.
- Use the official composer focus action when adding a quote to the conversation.

## [0.1.8] - 2026-09-16

- Support DSH `0.1.6-alpha.1` while retaining compatibility with the five previously supported host versions.

## [0.1.7] - 2026-09-13

- Add a compact conversation text-selection toolbar to quote text in the composer or ask an independent BTW question, alongside sidebar file-selection actions.
- Improve selection dismissal, keyboard interaction, and quote insertion; preserve code line breaks and provide a floating-toolbar fallback for browsers without the Popover API.

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
