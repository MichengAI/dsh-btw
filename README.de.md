<p align="center">
  <img src="https://raw.githubusercontent.com/MichengAI/dsh-btw/2d8dd7752cec1b29dd705969eaa932635ba0bf4f/assets/branding/dsh-btw-banner.png" alt="DSH BTW" width="100%">
</p>

<div align="center">

# DSH BTW

**Spontane Nebenfragen in der aktuellen DeepSeek Harness-Sitzung stellen: nur antworten, keine Tools ausführen**

[简体中文](README.zh-CN.md) · [English](README.en.md) · [日本語](README.ja.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

[Screenshots](#benutzeroberfläche) · [Installation](#installation) · [Nutzung](#nutzung) · [Änderungsprotokoll](CHANGELOG.md) · [Apache-2.0](LICENSE)

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)
[![DSH Web Plugin](https://img.shields.io/badge/DSH%20Web-Plugin-0f766e.svg)](https://github.com/deepseek-ai/deepseek-harness)
[![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org/)

</div>

> DSH BTW ist ein von der Community gepflegtes DeepSeek Harness-Plugin und kein offizielles Produkt von DeepSeek AI. Geben Sie in der aktuellen Konversation `/btw Ihre Frage` ein, um eine kontextbezogene Antwort in einer separaten Sprechblase zu erhalten, ohne die Hauptaufgabe zu unterbrechen. Unterstützt DSH Web sowie Desktop-Apps, die DSH Web integrieren. Ab Version `1.0.0` werden nicht unterstützte Host-Versionen durch die Versionsschranke sicher abgefangen.

## Funktionsübersicht

- **Kontextbezogene Nebenfragen**: Erklären Sie Konzepte, fassen Sie Ergebnisse zusammen oder klären Sie spontane Fragen zum aktuellen Chatverlauf.
- **Nur Antworten, keine Ausführung**: Liest keine neuen Dateien, ruft kein Internet auf, führt keine Befehle aus und ändert keinen Code.
- **Unabhängige Antwortblasen**: Unterstützt Markdown, mathematische Formeln, Kopieren, Einklappen, Ausklappen und Schließen.
- **Hauptaufgabe ungestört weiterführen**: Nebenfragen werden separat beantwortet und standardmäßig nicht in den Hauptchat geschrieben.
- **Rückmeldung nur auf Wunsch**: Bitten Sie in Ihrer Frage explizit darum („Sende die Antwort an die Hauptkonversation zurück“), damit per `send_message` eine vollständige Antwort übertragen wird.
- **Jederzeit abbrechen**: Das Schließen einer antwortenden Blase bricht diese Nebenfrage sofort ab.
- **Umfassende Lokalisierung & Themes**: Folgt dem hellen und dunklen DSH-Design und unterstützt nativ alle 8 offiziellen Sprachen (Deutsch, Englisch, Chinesisch, Japanisch, Spanisch, Französisch, Russisch, Portugiesisch).

## Benutzeroberfläche

### Nebenfragen im Standard-DSH

Die Hauptkonversation bleibt an ihrem Platz, während die Nebenfrage-Antwort direkt über dem Eingabefeld erscheint.

![BTW Antwortblase in der Konversation](https://raw.githubusercontent.com/MichengAI/dsh-btw/2d8dd7752cec1b29dd705969eaa932635ba0bf4f/assets/screenshots/btw-conversation.png)

### Befehlsmenü

Geben Sie `/` ein und wählen Sie `btw` unter Befehle oder tippen Sie direkt `/btw Ihre Frage`.

![Der Befehl btw im offiziellen Menü](https://raw.githubusercontent.com/MichengAI/dsh-btw/2d8dd7752cec1b29dd705969eaa932635ba0bf4f/assets/screenshots/btw-command-menu.png)

### Unabhängige Antwortblasen

Jede Nebenfrage besitzt eine eigene Blase mit Schaltflächen zum Kopieren, Einklappen/Ausklappen und Schließen.

![Mehrere Antwortblasen mit Bedienelementen](https://raw.githubusercontent.com/MichengAI/dsh-btw/2d8dd7752cec1b29dd705969eaa932635ba0bf4f/assets/screenshots/btw-bubbles.png)

### Einstellungen für Nebenfragen

Öffnen Sie **Plugins**, wählen Sie `@michengai/dsh-btw` aus und passen Sie Tool-Whitelist sowie Prompts direkt auf der Detailseite an.

![Einstellungsformular für Nebenfragen](assets/screenshots/btw-settings-panel.png)

### Diagramme in Nebenfragen zeichnen

Mit `pele_draw` auf der Whitelist kann eine Nebenfrage Diagramme generieren, ohne den Hauptchat zu verändern.

![Diagrammerstellung mit pele_draw](assets/screenshots/btw-pele-draw.png)

## DSH Produkt-Ökosystem

Für eine vollwertige Desktop-Workbench laden Sie [DSH Codex Desktop](https://github.com/MichengAI/dsh-codex-desktop/releases) herunter. In bestehenden [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)-Umgebungen können Plugins nach Bedarf installiert werden:

| Plugin | Zweck |
| --- | --- |
| [Codex UI](https://github.com/MichengAI/dsh-codex-ui) | Projekte & Sitzungen organisieren, Aufgabensuche und Runden-Navigation |
| [Agency Agents](https://github.com/MichengAI/dsh-agency-agents) | Fachagenten je nach Aufgabe auswählen und aufrufen |
| [Skills Manager](https://github.com/MichengAI/dsh-skills-manager) | Lokale Skills finden, aktivieren, erstellen und importieren |
| [Archive Manager](https://github.com/MichengAI/dsh-archive-manager) | Archivierte Sitzungen durchsuchen, wiederherstellen oder bereinigen |
| [IM Connect](https://github.com/MichengAI/dsh-im-connect) | Aufgaben über Messenger-Plattformen zuweisen und Antworten erhalten |
| [Automation](https://github.com/MichengAI/dsh-automation) | Geplante Aufgaben ausführen und Ausführungsverläufe einsehen |
| [BTW](https://github.com/MichengAI/dsh-btw) | Spontane Nebenfragen im Kontext stellen, ohne die Hauptaufgabe zu stören |
| [Simplify](https://github.com/MichengAI/dsh-simplify) | Git-Änderungsbereiche mit `/simplify` aufräumen und optimieren |
| [PUA](https://github.com/MichengAI/dsh-pua) | Agenten bei Fehlern anleiten, Ansätze zu korrigieren und Ergebnisse zu prüfen |
| [Code Review](https://github.com/MichengAI/dsh-code-review) | Unabhängige Code-Reviews mit `/review` starten und Berichte im Chat erhalten |
| [Codex Pet](https://github.com/MichengAI/dsh-codex-pet) | Sitzungsbenachrichtigungen, Tool-Genehmigungen und Antworten via Desktop-Pet |

## Voraussetzungen

- DeepSeek Harness installiert.
- Unterstützter Versionsbereich: DeepSeek Harness `0.2.x` (`>=0.2.0-rc.1 <0.3.0-0`).
- Node.js 22+, Befehl `dsh` im Terminal verfügbar.

## Installation

### Installation durch Agenten (Empfohlen)

Senden Sie die folgende Anweisung an einen beliebigen Agenten mit Terminalzugriff:

```text
Bitte installieren Sie das DSH-Plugin @michengai/dsh-btw im lokalen Web-Profil mit: dsh plugin --profile web add @michengai/dsh-btw@latest --registry=https://registry.npmjs.org/. Führen Sie danach dsh --profile web --dump-config aus, um sicherzustellen, dass michengai-btw enthalten ist, und erklären Sie mir, wie ich DSH neu lade.
```

### Manuelle Installation via npm

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

dsh plugin --profile web add @michengai/dsh-btw@latest --registry=https://registry.npmjs.org/
```

### Neu laden

Installieren oder aktualisieren Sie nach Abschluss laufender Aufgaben. Starten Sie bei Bedarf `dsh web` neu oder nutzen Sie die Neuladen-Funktion der Desktop-App.

## Nutzung

### Ausgewählten Text befragen

Markieren Sie Text in einer Nachricht und wählen Sie in der Leiste „Zu diesem Text fragen“. Geben Sie Ihre Frage ein und drücken Sie die Eingabetaste oder klicken Sie auf „Dies erklären“.

### Befehlsbasierte Nebenfrage

```text
/btw Fasse den vorherigen Lösungsansatz in einem einzigen Satz zusammen
```

| Ziel | Aktion |
| --- | --- |
| Nebenfrage stellen | `/btw Ihre Frage` eingeben oder `btw` aus dem Menü `/` wählen |
| Antwort ansehen | Warten, bis die Blase über dem Eingabefeld erscheint |
| Antwort kopieren | Kopiersymbol oben rechts an der Blase anklicken |
| Ein-/Ausklappen | Falt-Symbol oben rechts anklicken |
| Frage abbrechen | Blase während der Generierung schließen (Hauptaufgabe läuft weiter) |
| Blase entfernen | Fertige Blasen schließen |

## Konfiguration

Unter **Plugins** finden Sie bei `@michengai/dsh-btw` die Schaltfläche **Konfiguration**.

| Einstellung | Funktion |
| --- | --- |
| **Erlaubte Tools** | Namen zusätzlicher Tools neben `send_message`, eines pro Zeile (z. B. `pele_draw`). Leer erlaubt nur Text (Standard). |
| **Benutzerdefinierter Prompt** | Ersetzt den integrierten Prompt. Vorbefüllt mit dem Standardtext zur einfachen Anpassung. |

## Deinstallation

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

dsh plugin --profile web remove @michengai/dsh-btw
```

## Lizenz

[Apache-2.0](LICENSE) © 2026 MichengAI.
