<p align="center">
  <img src="https://raw.githubusercontent.com/MichengAI/dsh-btw/2d8dd7752cec1b29dd705969eaa932635ba0bf4f/assets/branding/dsh-btw-banner.png" alt="DSH BTW" width="100%">
</p>

<div align="center">

# DSH BTW

**DeepSeek Harness の現在のセッションで手軽にサイド質問。回答のみ行い、ツールは実行しません**

[简体中文](README.zh-CN.md) · [English](README.en.md) · [日本語](README.ja.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

[スクリーンショット](#画面プレビュー) · [インストール](#インストール) · [使い方](#使い方) · [更新履歴](CHANGELOG.md) · [Apache-2.0](LICENSE)

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)
[![DSH Web Plugin](https://img.shields.io/badge/DSH%20Web-Plugin-0f766e.svg)](https://github.com/deepseek-ai/deepseek-harness)
[![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org/)

</div>

> DSH BTW はコミュニティによって保守されている DeepSeek Harness プラグインであり、DeepSeek AI 公式の製品ではありません。現在の会話で `/btw 質問` と入力することで、メインタスクを中断せずに独立したバブルでコンテキストに応じた回答を得ることができます。DSH Web および DSH Web を統合したデスクトップアプリに対応しています。`1.0.0` 以降、サポート対象外のホストはバージョンゲートによって拒否され、プラグインは実行されません（既存の設定やメインセッションの記録は保持されます）。

## 機能概要

- **コンテキストに応じたサイド質問**：現在の会話内容に基づいて概念を説明したり、結論を振り返ったり、一時的な疑問を解消します。
- **回答のみ・ツール実行なし**：ファイルの読み込み、Web 検索、コマンド実行、コード変更は一切行いません。
- **独立した回答バブル**：Markdown、数式、コピー、折りたたみ、展開、閉じる操作に対応。複数のサイド質問を同時に確認できます。
- **メインタスクを妨げない**：サイド質問は単独で回答され、デフォルトでメインセッションに結果が書き込まれることはありません。
- **必要なときだけ結果を送信**：メインの会話に結論を残したい場合は、質問内で「回答をメイン会話に送信して」と明示的に指示すると、`send_message` を使って自己完結した回答をメインセッションに返送します。指示がない限り返送しません。
- **いつでもキャンセル可能**：生成中の回答バブルを閉じるだけで、そのサイド質問を即座にキャンセルできます。
- **全言語対応とテーマ**：DSH のライト・ダークテーマに追従し、公式の全 8 門言語（日本語、英語、中国語、スペイン語、フランス語、ドイツ語、ロシア語、ポルトガル語）をネイティブサポート。

## 画面プレビュー

### ネイティブ DSH でのサイド質問

メインセッションは元の位置に保たれ、サイド質問の回答は入力欄の上に独立して表示されます。

![ネイティブ DSH セッション内の BTW 独立回答バブル](https://raw.githubusercontent.com/MichengAI/dsh-btw/2d8dd7752cec1b29dd705969eaa932635ba0bf4f/assets/screenshots/btw-conversation.png)

### コマンド入力

`/` を入力後、「コマンド」メニューから `btw` を選択するか、直接 `/btw 質問内容` を入力できます。

![公式コマンドメニュー内の btw エントリ](https://raw.githubusercontent.com/MichengAI/dsh-btw/2d8dd7752cec1b29dd705969eaa932635ba0bf4f/assets/screenshots/btw-command-menu.png)

### 独立した回答バブル

各サイド質問は個別のバブルで表示され、右上からコピー、折りたたみ／展開、閉じる操作が可能です。

![複数のサイド質問バブルと操作ボタン](https://raw.githubusercontent.com/MichengAI/dsh-btw/2d8dd7752cec1b29dd705969eaa932635ba0bf4f/assets/screenshots/btw-bubbles.png)

### サイド質問の設定

**プラグイン** を開き、`@michengai/dsh-btw` を選択すると、詳細ページ上に直接設定フォームが表示されます。許可ツールリストとプロンプト入力欄があり、プロンプトには組み込み文言があらかじめ入力されています。

![プラグイン詳細ページ上のサイド質問設定フォーム](assets/screenshots/btw-settings-panel.png)

### サイド質問で図を描画

`pele_draw` をホワイトリストに追加すると、サイド質問でも図を描画できます。図はサイド質問パネル内に表示され、メイン会話には影響しません。

![pele_draw を呼び出してフローチャートを描画](assets/screenshots/btw-pele-draw.png)

## DSH プロダクトエコシステム

デスクトップワークベンチをご希望の場合は、[DSH Codex Desktop](https://github.com/MichengAI/dsh-codex-desktop/releases) をダウンロードしてください。既存の [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 環境がある場合は、各プロジェクトの README に従って個別にインストールできます。

| プラグイン | 用途 |
| --- | --- |
| [Codex UI](https://github.com/MichengAI/dsh-codex-ui) | プロジェクトやセッションの整理、タスク検索、会話ターンの移動 |
| [Agency Agents](https://github.com/MichengAI/dsh-agency-agents) | タスクに応じて専門エージェントを選択・召喚 |
| [Skills Manager](https://github.com/MichengAI/dsh-skills-manager) | ローカルスキルの検索、有効化・無効化、作成およびインポート |
| [Archive Manager](https://github.com/MichengAI/dsh-archive-manager) | アーカイブされたセッションの検索、復元、クリーンアップ |
| [IM Connect](https://github.com/MichengAI/dsh-im-connect) | メッセージングプラットフォームからタスクを割り当てて回答を受信 |
| [Automation](https://github.com/MichengAI/dsh-automation) | スケジュールに基づいてタスクを実行し、各実行結果を確認 |
| [BTW](https://github.com/MichengAI/dsh-btw) | メインタスクを妨げずに現在のコンテキストで手軽にサイド質問 |
| [Simplify](https://github.com/MichengAI/dsh-simplify) | `/simplify` を使って Git 変更範囲内のコードをクリーンアップ |
| [PUA](https://github.com/MichengAI/dsh-pua) | 失敗時にアプローチを変更・原因究明し、完了前に検証するようエージェントを誘導 |
| [Code Review](https://github.com/MichengAI/dsh-code-review) | `/review` を使って独立したコードレビューを開始し、セッション内でレポートを受信 |
| [Codex Pet](https://github.com/MichengAI/dsh-codex-pet) | デスクトップペットを通じてセッション通知を確認し、承認や回答を処理 |

## 前提条件

- DeepSeek Harness がインストールされていること。
- ホスト対応バージョン：DeepSeek Harness `0.2.x` 全系列（`>=0.2.0-rc.1 <0.3.0-0`）。
- Node.js 22+、ターミナルで `dsh` コマンドが実行できること。

## インストール

以下のコマンドでは `web` プロファイルを使用しています。実際の環境に合わせて置き換えてください。

### エージェントに依頼してインストール（推奨）

ローカルのターミナルコマンドを実行できるエージェントに以下のテキストを送信してください：

```text
DSH プラグイン @michengai/dsh-btw をローカルの web プロファイルにインストールしてください：dsh plugin --profile web add @michengai/dsh-btw@latest --registry=https://registry.npmjs.org/。インストール後、dsh --profile web --dump-config を実行して設定に michengai-btw が含まれていることを確認し、DSH の再読み込み方法と使い方を教えてください。
```

### 手動で npm からインストール

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

dsh plugin --profile web add @michengai/dsh-btw@latest --registry=https://registry.npmjs.org/
```

### 再読み込み

現在のタスクが終了した後にインストールまたは更新してください。デスクトップアプリは自動的に再読み込みされる場合があります。反映されない場合は、デスクトップアプリの「再読み込み」を使用するか、`dsh web` サービスを再起動してください。

## 使い方

### テキスト選択からのサイド質問

セッション内のテキストを選択すると、選択範囲の上に表示されるバーから「サイド質問」を選択できます。質問を入力して Enter キーで送信するか、「説明する」をクリックします。Shift+Enter で改行、Esc でキャンセルします。

- 通常の段落、リスト、コードブロックに対応。1回の引用につき最大 8,000 文字まで対応しています。
- 引用は選択時に固定され、本文の生成が続いても変更されません。
- メイン入力欄の草稿を消費したりクリアしたりすることはありません。

### コマンドでのサイド質問

会話のコンテキストがあるセッションで次のように入力します：

```text
/btw 今の設計案を1行で要約して
```

| 目的 | 操作 |
| --- | --- |
| サイド質問をする | `/btw 質問内容` を入力して送信、または `/` メニューから `btw` を選択 |
| 回答を確認する | 入力欄の上に独立したバブルが表示されるのを待つ |
| 回答をコピーする | バブル右上のコピーアイコンをクリック |
| 折りたたむ／展開する | バブル右上の折りたたみ／展開アイコンをクリック |
| サイド質問をキャンセル | 生成中に対応するバブルを閉じる（メインタスクは継続） |
| バブルを削除する | 完了したバブルを閉じる |

## 設定

設定はすべて任意です。空欄のままにしておくと、デフォルトの純粋なテキスト回答と組み込みプロンプトが使用されます。

**プラグイン** を開き、`@michengai/dsh-btw` の行にある **設定** をクリックします。

| 設定項目 | 説明 |
| --- | --- |
| **許可ツール** | `send_message` 以外にサイド質問で呼び出しを許可するツール名（1行に1つ、例: `pele_draw`）。空欄の場合はテキストのみ許可（デフォルト）。 |
| **カスタムプロンプト** | 組み込みプロンプトを上書きします。組み込み文言があらかじめ入力されているため直接変更可能。元に戻して保存するとデフォルトに戻ります。 |

## アンインストール

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

dsh plugin --profile web remove @michengai/dsh-btw
```

## ライセンス

[Apache-2.0](LICENSE) © 2026 MichengAI。
