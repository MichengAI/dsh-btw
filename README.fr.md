<p align="center">
  <img src="https://raw.githubusercontent.com/MichengAI/dsh-btw/2d8dd7752cec1b29dd705969eaa932635ba0bf4f/assets/branding/dsh-btw-banner.png" alt="DSH BTW" width="100%">
</p>

<div align="center">

# DSH BTW

**Posez des questions secondaires dans la session en cours de DeepSeek Harness : répond uniquement, sans exécuter d'outils**

[简体中文](README.zh-CN.md) · [English](README.en.md) · [日本語](README.ja.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

[Captures](#aperçu-de-linterface) · [Installation](#installation) · [Utilisation](#utilisation) · [Journal des modifications](CHANGELOG.md) · [Apache-2.0](LICENSE)

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)
[![DSH Web Plugin](https://img.shields.io/badge/DSH%20Web-Plugin-0f766e.svg)](https://github.com/deepseek-ai/deepseek-harness)
[![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org/)

</div>

> DSH BTW est un plugin DeepSeek Harness maintenu par la communauté, et non un produit officiel de DeepSeek AI. Saisissez `/btw votre question` dans la session en cours pour obtenir une réponse contextuelle dans une bulle autonome, sans interrompre la tâche principale. Compatible avec DSH Web et les applications de bureau intégrant DSH Web. À partir de la version `1.0.0`, les hôtes non pris en charge sont rejetés en toute sécurité par la barrière de version.

## Vue d'ensemble

- **Questions contextuelles** : obtenez l'explication d'un concept, un récapitulatif ou des clarifications sans perdre le fil.
- **Réponse uniquement, aucune exécution** : ne lit pas de nouveaux fichiers, ne navigue pas sur le web, n'exécute pas de commandes et ne modifie aucun code.
- **Bulles de réponse indépendantes** : prise en charge du Markdown, des formules mathématiques, de la copie, du repli, du déploiement et de la fermeture.
- **N'interrompt pas la tâche principale** : les questions secondaires sont traitées à part et ne sont pas ajoutées à la conversation principale par défaut.
- **Renvoi sur demande** : demandez explicitement dans votre question de « renvoyer la réponse à la conversation principale » pour que `send_message` transmette une réponse autonome à la session principale.
- **Annulation à tout moment** : fermer la bulle pendant la génération annule immédiatement la question secondaire.
- **Internationalisation complète & thèmes** : suit le thème clair/sombre de DSH avec prise en charge native des 8 langues officielles (français, anglais, chinois, japonais, espagnol, allemand, russe, portugais).

## Aperçu de l'interface

### Question secondaire dans DSH

La conversation principale reste à sa place et la réponse secondaire s'affiche au-dessus de la zone de saisie.

![Bulle de réponse indépendante](https://raw.githubusercontent.com/MichengAI/dsh-btw/2d8dd7752cec1b29dd705969eaa932635ba0bf4f/assets/screenshots/btw-conversation.png)

### Menu de commandes

Tapez `/` et choisissez `btw` dans le menu des commandes, ou tapez directement `/btw votre question`.

![Entrée btw dans le menu de commandes](https://raw.githubusercontent.com/MichengAI/dsh-btw/2d8dd7752cec1b29dd705969eaa932635ba0bf4f/assets/screenshots/btw-command-menu.png)

### Bulles de réponse autonomes

Chaque question secondaire dispose de sa propre bulle avec des boutons pour copier, réduire/développer et fermer.

![Bulles de réponse multiples](https://raw.githubusercontent.com/MichengAI/dsh-btw/2d8dd7752cec1b29dd705969eaa932635ba0bf4f/assets/screenshots/btw-bubbles.png)

### Configuration des questions secondaires

Ouvrez **Plugins**, sélectionnez `@michengai/dsh-btw` pour afficher directement le formulaire de configuration : liste blanche d'outils et invite personnalisée.

![Formulaire de configuration du plugin](assets/screenshots/btw-settings-panel.png)

### Générer des diagrammes

En ajoutant `pele_draw` à la liste blanche, la question secondaire peut également générer des diagrammes Mermaid sans modifier la conversation principale.

![Rendu de diagramme avec pele_draw](assets/screenshots/btw-pele-draw.png)

## Écosystème DeepSeek Harness

Pour utiliser l'espace de travail sur bureau, téléchargez [DSH Codex Desktop](https://github.com/MichengAI/dsh-codex-desktop/releases). Pour une installation existante de [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), installez les plugins selon vos besoins :

| Plugin | Description |
| --- | --- |
| [Codex UI](https://github.com/MichengAI/dsh-codex-ui) | Gestion des projets, recherche de tâches et navigation par tour |
| [Agency Agents](https://github.com/MichengAI/dsh-agency-agents) | Sélectionner et invoquer des agents experts par tâche |
| [Skills Manager](https://github.com/MichengAI/dsh-skills-manager) | Recherche, activation, création et importation de compétences |
| [Archive Manager](https://github.com/MichengAI/dsh-archive-manager) | Recherche, restauration et nettoyage des sessions archivées |
| [IM Connect](https://github.com/MichengAI/dsh-im-connect) | Assigner des tâches et recevoir les réponses via messagerie instantanée |
| [Automation](https://github.com/MichengAI/dsh-automation) | Exécution planifiée de tâches et historique des runs |
| [BTW](https://github.com/MichengAI/dsh-btw) | Questions annexes rapides sans interrompre la tâche principale |
| [Simplify](https://github.com/MichengAI/dsh-simplify) | Nettoyer et simplifier le code modifié avec `/simplify` |
| [PUA](https://github.com/MichengAI/dsh-pua) | Guider l'agent pour corriger ses approches et valider les résultats |
| [Code Review](https://github.com/MichengAI/dsh-code-review) | Lancer des revues de code indépendantes avec `/review` |
| [Codex Pet](https://github.com/MichengAI/dsh-codex-pet) | Alertes, approbations d'outils et réponses via un compagnon de bureau |

## Prérequis

- DeepSeek Harness installé.
- Compatibilité hôte : série DeepSeek Harness `0.2.x` (`>=0.2.0-rc.1 <0.3.0-0`).
- Node.js 22+, commande `dsh` accessible dans le terminal.

## Installation

### Installation assistée par Agent (Recommandé)

Transmettez ce message à un agent ayant accès au terminal local :

```text
Veuillez installer le plugin DSH @michengai/dsh-btw dans le profil web local en exécutant : dsh plugin --profile web add @michengai/dsh-btw@latest --registry=https://registry.npmjs.org/. Après l'installation, exécutez dsh --profile web --dump-config pour confirmer la présence de michengai-btw et expliquez-moi comment recharger DSH.
```

### Installation manuelle via npm

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

dsh plugin --profile web add @michengai/dsh-btw@latest --registry=https://registry.npmjs.org/
```

### Rechargement

Installez ou mettez à jour après avoir terminé les tâches en cours. Si les modifications ne s'appliquent pas, utilisez la fonction « Recharger » de l'application ou redémarrez `dsh web`.

## Utilisation

### Poser une question sur un texte sélectionné

Sélectionnez du texte dans un message et cliquez sur « Poser une question sur ce texte » dans la barre flottante. Saisissez votre question et appuyez sur Entrée, ou cliquez sur « Expliquer cela ». Shift+Entrée pour un saut de ligne, Échap pour annuler.

### Poser une question via une commande

```text
/btw Résume la solution précédente en une seule phrase
```

| Objectif | Action |
| --- | --- |
| Poser une question secondaire | Tapez `/btw votre question` ou choisissez `btw` dans le menu `/` |
| Consulter la réponse | Attendez l'apparition de la bulle dédiée au-dessus de la saisie |
| Copier la réponse | Cliquez sur l'icône de copie dans le coin de la bulle |
| Réduire ou développer | Cliquez sur l'icône de pliage/dépliage |
| Annuler la question | Fermez la bulle pendant la génération (la tâche principale continue) |
| Supprimer la bulle | Fermez les bulles terminées |

## Configuration

Rendez-vous dans **Plugins**, trouvez `@michengai/dsh-btw` et cliquez sur **Configuration**.

| Option | Rôle |
| --- | --- |
| **Outils autorisés** | Outils pouvant être appelés en plus de `send_message`, un par ligne (ex. `pele_draw`). Vide par défaut (texte seul). |
| **Invite personnalisée** | Remplace l'invite intégrée. Pré-remplie avec le texte par défaut pour faciliter les ajustements. |

## Désinstallation

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

dsh plugin --profile web remove @michengai/dsh-btw
```

## Licence

[Apache-2.0](LICENSE) © 2026 MichengAI.
