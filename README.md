<div align="center">

# DSH BTW

**Ask a side question in DeepSeek Harness. Answers only, no tool execution.**

[简体中文](README.zh-CN.md) · [Screenshots](#screenshots) · [Installation](#installation) · [Usage](#usage) · [Changelog](CHANGELOG.md) · [Apache-2.0](LICENSE)

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)
[![DSH Web Plugin](https://img.shields.io/badge/DSH%20Web-Plugin-0f766e.svg)](https://github.com/deepseek-ai/deepseek-harness)
[![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org/)

</div>

Type `/btw your question` in the existing chat composer to get an answer based on your conversation's context. Answers appear in independent bubbles above the composer, ready for a quick explanation, recap, or follow-up question.

DSH BTW is a community-maintained plugin for DSH Web and desktop apps that host the Web client. It does not occupy the sidebar, require Codex UI, or open a separate page.

## Features

- **Context-aware questions**: each question starts a one-shot child agent that inherits completed turns from the main session.
- **Answers only**: all tools are disabled. The agent cannot read new files, browse the web, run commands, or edit code.
- **Independent answer bubbles**: render Markdown, copy answers, collapse, expand, and close individual bubbles. Multiple answers can stay visible.
- **Separate from the main task**: answers are not added to the main model's history, and previous side questions do not become context for later ones.
- **Cancellation and cleanup**: closing a running bubble cancels only that question. Cleanup failures remain visible so closing can be retried.
- **Themes and languages**: follow DSH light and dark themes and switch between Chinese and English UI.

## Screenshots

These screenshots were provided by the user from the actual DSH dark interface. Model responses shown in them illustrate the bubble UI only.

### Side questions in stock DSH

The main conversation stays in place, with the side answer above the composer.

![A BTW answer bubble in the stock DSH conversation](assets/screenshots/btw-conversation.png)

### Command menu

Type `/` and select `btw` under the side-question category, or enter `/btw your question` directly.

![The side-question category and btw command](assets/screenshots/btw-command-menu.png)

### Independent answer bubbles

Each answer has its own copy, collapse or expand, and close controls in the upper right.

![Multiple answer bubbles with copy, collapse, and close controls](assets/screenshots/btw-bubbles.png)

## Prerequisites

- A working DeepSeek Harness Web installation with `dsh` available in PowerShell.
- The development baseline is DSH `0.1.2-rc.1`. The host must provide a `fork` child agent with context inheritance, tool filtering, and persona support.
- Source builds require Node.js 22+ and npm.
- Examples use the `web` profile; replace it with your target profile.

## Installation

Install from npm, local source, or a built package.

Source repository: <https://github.com/MichengAI/dsh-btw>. Download `.tgz` packages from [Releases](https://github.com/MichengAI/dsh-btw/releases).

### From npm

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

dsh plugin --profile web add @michengai/dsh-btw@latest --registry=https://registry.npmjs.org/
dsh --profile web --dump-config
```

Use `@0.1.0` instead of `@latest` to pin the first release. Reload DSH after installation as described below.

### From local source

Run from the project root:

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

npm ci --ignore-scripts
npm run build
dsh plugin --profile web add . --ignore-scripts
dsh --profile web --dump-config
```

Confirm that the configuration includes `michengai-btw`. A local directory installation reads the package metadata and `cordis.patch.yml`; do not copy `lib` separately.

### From a package archive

Build an archive with `npm pack` from the project root, then install it:

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

npm pack
dsh plugin --profile web add .\michengai-dsh-btw-0.1.0.tgz --ignore-scripts
dsh --profile web --dump-config
```

For an existing `.tgz`, substitute its path in the installation command. Disable other plugins that claim `/btw` before installing.

### Reloading

DSH Codex Desktop may automatically reload its service when plugin configuration changes. Install or update after current tasks have finished. Other DSH Web launch methods require a manual restart.

Rebuilding a linked plugin does not reload the backend. The current host's `patchReload: live` watches configuration, while backend HMR with `root: []` does not watch plugin JavaScript. The frontend can show new labels while the backend still serves the old command directory. Use the desktop app's reload action, or restart the relevant `dsh web` process, after tasks finish. Refreshing the browser alone does not update backend code.

## Usage

In a conversation with existing context, enter:

```text
/btw Why does the proposed design use a one-shot child agent?
```

| Goal | Action |
| --- | --- |
| Ask a side question | Submit `/btw your question`, or choose `btw` from the `/` menu. |
| Read the answer | Wait for the answer in the independent bubble above the composer. |
| Copy an answer | Click the copy icon in the bubble's upper right. |
| Collapse or expand | Click the collapse or expand icon. |
| Cancel a question | Close its bubble while it is running. The main task is unaffected. |
| Dismiss an answer | Close the completed bubble. |
| Ask again | Submit another `/btw` question. Each question is independent. |

Use the regular conversation to run commands, edit code, or continue the main task. BTW can only answer using existing context.

Arrow-key input history belongs to Codex UI. BTW does not collect input history, access history storage, or bind arrow keys. Installing BTW alone adds side questions only.

## Compatibility and Boundaries

The development baseline is DSH `0.1.2-rc.1`. The host needs commands, tools, subagents, and a fork provider supporting tool filtering, persona, and inherited context. Requests fail when these capabilities are unavailable. The client needs conversation, input-trigger, chat, api-remotes, locale, and host theme tokens.

The child agent receives an empty tool allowlist. An execution guard also rejects all tools, including `run_code` and tools registered within child scopes.

Forks inherit completed turns, excluding the turn currently being generated. Disposing a child agent does not delete host audit logs. Command results are not added to the main model history, but the host may retain command and child-agent records.

Internal commands `btw-run` and `btw-close` are hidden from the command directory. They use the host's session RPC rather than adding HTTP endpoints. Users only need `/btw` and the bubble controls.

`btw-run` accepts JSON `{ id, question, locale? }`. Supported locales are `zh` and `en`; omission defaults to Chinese for older clients, and other languages fall back to English. The response uses the host command's `{ kind, text }` format. `btw-close` accepts the raw request identifier; cleanup errors retain the request's language.

Each question is limited to 8,000 characters, with a 90-second timeout and at most eight concurrent requests.

Bubbles are stored in client memory only and are not restored after a refresh. Appearance follows the current DSH theme, independently of the operating system's dark-mode preference. UI translations update through the host locale service; server messages use the language at submission time. Model answers and original external errors are not translated.

Local installation and outstanding acceptance checks are tracked in [Current Status](docs/00-交接入口/02-当前状态.md). Runtime and simulated-host tests do not replace actual DSH model and interaction checks.

## Uninstallation

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

dsh plugin --profile web remove @michengai/dsh-btw
```

Reload DSH afterward. Disabling or updating the plugin does not delete the main conversation's records.

## Development

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

npm ci --ignore-scripts
npm run check
```

`npm run check` runs type checking, unit and release-script tests, and a build. `npm run dev` provides a simulated host with mock answers for development, without connecting to a real model. DSH remains the actual plugin entry point. Theme CSS and LocaleRuntime come from the matching official development dependencies.

`npm run test:browser` checks bubbles, cancellation, narrow layouts, Markdown, themes, contrast, language switching, and the absence of arrow-key interception.

Build before running browser tests. Playwright manages `npm run dev` automatically and uses Microsoft Edge locally and Chromium in CI. `tests/host.test.ts` loads the host from the `node_modules` directory specified by `DSH_RUNTIME_ROOT`, defaulting to `.dsh/profiles/node_modules` under the user's home directory. The two tests are explicitly skipped when that host is absent; they do not read credentials or configuration. CI points at this project's development dependencies and executes the runtime tests.

`tests/command-visibility.test.ts` uses a real Typert Registry, Gateway, and command runtime to check directory filtering, execution, and unload restoration. An installed desktop runtime can also be tested by setting `DSH_DESKTOP_RUNTIME_ROOT`. Passing these tests does not prove that a running DSH process has reloaded the latest build.

## References and Credits

The side-question interaction was informed by [JasonQQ/dsh-btw-plugin](https://github.com/JasonQQ/dsh-btw-plugin), the close lifecycle by [kaieye/dsh-AIR](https://github.com/kaieye/dsh-AIR), and boundary handling by the Pi plugin below. This plugin is implemented independently.

References from [`@narumitw/pi-btw` 0.57.0](https://pi.dev/packages/@narumitw/pi-btw) and its [source](https://github.com/narumiruna/pi-extensions/tree/b4981b29604945d67ce2ce04e0f769c62bce1f20/packages/pi-btw):

- Snapshot context at question time instead of continuously following the main task. BTW uses a fork of completed turns.
- Recheck cancellation and reject late answers. BTW checks cancellation and request identity on both client and server.
- Do not write answers back to the main task by default. BTW only displays independent bubbles and does not bind history-navigation keys.

Pi calls the model directly without tools; BTW uses one-shot child agents. Pi's full-screen TUI, multi-turn recovery, and write-back features are not included.

## Project Documentation

The engineering documents are maintained in Chinese:

- [Reading Guide](docs/00-交接入口/00-阅读导航.md)
- [Current Status](docs/00-交接入口/02-当前状态.md)
- [Outstanding Work](docs/00-交接入口/03-待办与阻塞.md)
- [Automated Testing and Publishing](docs/05-工程交付/01-自动发布.md)

## License

[Apache-2.0](LICENSE). Copyright 2026 MichengAI.
