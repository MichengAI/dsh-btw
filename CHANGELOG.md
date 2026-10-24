# Changelog

## [1.0.5] - 2026-10-24

- Support DeepSeek Harness `0.2.1-rc.3` while retaining all existing supported versions.

## [1.0.4] - 2026-10-22

- Support structured quote references via host input trigger channel: Register `@dsh-btw-quote` source with dedicated clipboard and model prompt codecs, allowing quotes to be managed as atomic mention references without flattening long excerpts into composer drafts (#12).
- Render quote context in conversation bubbles as native ReferenceChip capsules: Parse leading selected context blocks into structured quote nodes, rendering compact capsules at the top of message bubbles with full card details mounted via React Portal to prevent container clipping (#12).
- Multi-card popover list with independent navigation: Display multiple referenced excerpts as discrete cards with distinct provenance badges, scrolling preview, and dedicated "Jump to source" actions for pinpoint anchor navigation (#12).
- Fortify quote heading parser against false positives: Enforce whitespace-only prefix bounds and require at least one valid quote item before creating a capsule, preventing in-text discussions or bare headings from being captured (#12).
- Harmonize detect coordinates and bilingual locale support: Use `captureInsertion()` for accurate detect-span offsets across existing mention chips, bind slot locale to `QuoteUserTextNode`, and complete bilingual localization (#12).
- Add `@deepseek-ai/dsh-client-ui-input-trigger` to peerDependencies across all supported host versions (0.2.0-rc.1 through 0.2.1-rc.2).

## [1.0.3] - 2026-10-22

- Fix main-session tool calls being suppressed when quoting text: Remove side-ask-specific tool prohibition instructions from quote prompt formatting so the main agent can still invoke tools as needed (#11).
- Prevent Enter key and click event overreach in dialogs: Exclude selection modals and dialogs from global keydown capture and click handlers, preventing side-question input from polluting the main draft (#13).
- Guard draft merging and expansion against non-plain submission phases: Prevent quote data loss when submitting messages in flight (#13).
- Refine quote deduplication and prevent empty-question submission: Deduplicate quotes by content, role, and turn index to support identical excerpts across turns, and intercept Enter on empty drafts to avoid sending blank queries (#14).
- Distinguish host send and stop buttons: Accurately match send, queue, and steer message actions in the host InputBar while explicitly ignoring the stop generation button, avoiding premature quote consumption (#13).
- Support multiple quotes on the same DOM element and improve anchor lifecycle: Store space-separated anchor IDs on DOM nodes, recycle `data-btw-anchor` upon quote removal, and align fallback jump turn counting strictly with selection logic (#15).
- Unify terminology and enforce quote limits: Unify quote and note wording across UI and prompt, cap cumulative quotes at 16,000 characters with localized error messages, and clean up legacy callbacks (#15).

## [1.0.2] - 2026-10-21

- Prevent tool-call pattern pollution from inherited session context: Inject high-priority negative tool constraints into the trailing user prompt, instructing models that all tools are disabled and strictly forbidding tool calls or call tags in favor of direct text answers (#10).
- Add resilient sanitization on model outputs: Automatically strip leftover `<tool_call>` and `<function_call>` raw pseudo-blocks from the generated text, ensuring answers displayed in the bubble remain clean and well-formed (#10).

## [1.0.1] - 2026-10-21

- Align selection quoting and annotations with the Codex experience: Render a compact rounded pill above the composer, open an annotation drawer on click, support optional comments on selections, and serialize provenance metadata cleanly before send without flooding the main draft (#8).
- Integrate the host's native `<Modal>` and `<Button>` primitives for the selection question dialog, dropping custom overlays and aligning fully with host tokens and themes.
- Standardize subagent naming to "Side Question Expert", aligning with the expert agent roster and eliminating internal debug UUIDs from the task list.
- Enhance prompt structuring and guidance for selections, preventing instruction injection from quoted text and directing models to focus on the user's intent.

## [1.0.0] - 2026-10-17

- Supported hosts are now DeepSeek Harness `0.2.0-rc.1`, `0.2.0-rc.2`, `0.2.1-rc.1`, and `0.2.1-rc.2`. Hosts before `0.2.0`, and `0.2.1` alphas, are rejected by the version gate, and the plugin will not load or run. Installed configuration and main-conversation records are kept. If you still use a `0.1.x` host, install plugin `0.1.24` instead of `@latest`.
- `0.2.1-rc.1` and later use `startActivation`. `0.2.0-rc.1` and `0.2.0-rc.2` still use `subagents.start`.

## [0.1.24] - 2026-10-15

- Side questions are no longer offered in a subagent session. Typing `/btw` there explains that you should return to the main session, instead of leaving a dialog that cannot be closed (#7).
- Closing a side question that the host rejects because the session is owned by subagent routing no longer deletes an answer that is still on the way or already returned. A request that never started, or was cancelled before it produced an answer, can still be dismissed locally.

## [0.1.23] - 2026-10-15

- Relax hardcoded timeout: Replace the strict 90s timer with a 30-minute watchdog, supporting long chain-of-thought and max-reasoning models while safeguarding concurrency slots against stalled connections (#6).
- Prominent stop button during answering: Display a dedicated stop button with alert styling during generation, allowing users to manually abort reasoning and release subagent resources immediately (#6).
- Smart auto-collapse for older side-question bubbles: Automatically collapse older bubbles when new side questions arrive, keeping the input area neat while preserving manual expansion controls and robust focus recovery.
- Seamless dual-generation host compatibility: Retain strict typings for DSH 0.2.1-alpha.3+ `startActivation` while providing a robust `subagents.start` fallback for DSH 0.2.0-rc.2 and earlier.

## [0.1.22] - 2026-10-15

- Support DSH `0.2.1-alpha.3` while retaining all existing supported versions; pin development `@deepseek-ai/dsh*` dependencies to host `0.2.1-alpha.3` and Cordis to `4.0.5-alpha.2`.
- Drop removed host package `@deepseek-ai/dsh-invariants` from development dependencies (gone since alpha.1).
- Adapt the subagent breaking change: `ctx.subagents.start` and start-time `persona` / `toolFilter` are gone; use `startActivation` with `delivery: 'caller'`, and restore the side-ask persona plus empty tool allow-list on the child's `agent/created` via a scoped persona section and `tools.restrict`.
- Fix the host regression that still called `tools.presentAs('both')` after alpha.2 removed that mode; the guard test covers `native` (scoped tools) and `ptc` (`run_code`) separately.

## [0.1.21] - 2026-10-14

- Use the raised layer token (`--dsw-alias-bg-layer-2`) for the selection question dialog and answer bubbles, fixing see-through text under wallpaper and transparent-canvas themes.

## [0.1.20] - 2026-10-13

- Tag injected styles with plugin ownership so the selection action bar keeps its rounded dark theme and does not fall back to browser default popover boxes after host theme changes or client reloads.

## [0.1.19] - 2026-10-12

- Support DSH `0.2.1-alpha.2` while retaining all existing supported versions.

## [0.1.18] - 2026-10-10

- Side questions start again when dsh-tui is installed. The plugin no longer fails to activate, so `/btw` stays available on hosts that use the command registry. Side questions still only answer and do not run tools. A side question that is still cleaning up after the plugin is removed cannot suddenly run tools.

## [0.1.17] - 2026-10-07

- Side-question answers use the host Markdown renderer, so `$...$`, `$$...$$`, and TeX delimiters render as formulas, matching the main conversation. Hosts without that renderer still show the original text. Copy keeps the raw Markdown, and answers do not load remote images.
- A code block’s own copy button says “Copy code” instead of reusing the whole-answer label.

## [0.1.16] - 2026-10-06

- The installed-plugin list shows “BTW” and a localized description instead of the package name. Titles and descriptions come from `meta.title` and `meta.description` in `locale/zh.json` and `locale/en.json`.
- Installing from GitHub now includes the compiled runtime, so no manual build is required.

## [0.1.15] - 2026-09-30

- Support DSH `0.2.0-rc.2` and keep the previous seven hosts working. Supported hosts are `0.1.2-rc.1`, `0.1.5-rc.1`, `0.1.5-rc.2`, `0.1.5-rc.3`, `0.1.7-rc.1`, `0.1.7-rc.2`, `0.2.0-rc.1`, and `0.2.0-rc.2`.

## [0.1.14] - 2026-09-28

- Support DSH `0.2.0-rc.1` and keep the previous seven hosts working. Supported hosts are `0.1.0-rc.8`, `0.1.1-rc.2`, `0.1.2-rc.1`, `0.1.5-rc.1`, `0.1.5-rc.2`, `0.1.7-rc.1`, `0.1.7-rc.2`, and `0.2.0-rc.1`.

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
