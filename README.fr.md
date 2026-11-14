<p align="center">
  <img src="https://raw.githubusercontent.com/MichengAI/dsh-btw/2d8dd7752cec1b29dd705969eaa932635ba0bf4f/assets/branding/dsh-btw-banner.png" alt="DSH BTW" width="100%">
</p>

<div align="center">

# DSH BTW

**Posez des questions secondaires dans la session en cours de DeepSeek Harness : répond uniquement, sans exécuter d'outils**

[简体中文](README.zh-CN.md) · [English](README.en.md) · [日本語](README.ja.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

[Journal des modifications](CHANGELOG.md) · [Apache-2.0](LICENSE)

[![Licence : Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)
[![DSH Web Plugin](https://img.shields.io/badge/DSH%20Web-Plugin-0f766e.svg)](https://github.com/deepseek-ai/deepseek-harness)
[![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org/)

</div>

> DSH BTW est un plugin DeepSeek Harness maintenu par la communauté, et non un produit officiel de DeepSeek AI. Saisissez `/btw votre question` dans la session en cours pour obtenir une réponse contextuelle dans une bulle autonome, sans interrompre la tâche principale. Compatible avec DSH Web et les applications de bureau intégrant DSH Web. À partir de la version `1.0.0`, les hôtes non pris en charge sont rejetés en toute sécurité par la barrière de version (la configuration installée et les données de conversation restent intactes).

## Vue d'ensemble

- **Questions contextuelles** : obtenez l'explication d'un concept, un récapitulatif ou des clarifications sans perdre le fil.
- **Réponse uniquement, aucune exécution** : ne lit pas de nouveaux fichiers, ne navigue pas sur le web, n'exécute pas de commandes et ne modifie aucun code.
- **Bulles de réponse indépendantes** : prise en charge du Markdown, des formules mathématiques, de la copie, du repli, du déploiement et de la fermeture. Plusieurs réponses peuvent être consultées simultanément.
- **N'interrompt pas la tâche principale** : les questions secondaires sont traitées à part et ne sont pas ajoutées à la conversation principale par défaut.
- **Renvoi sur demande** : demandez explicitement dans votre question de « renvoyer la réponse à la conversation principale » pour que `send_message` transmette une réponse autonome à la session principale. Aucun renvoi n'est effectué sans demande expresse.
- **Annulation à tout moment** : fermer la bulle pendant la génération annule immédiatement la question secondaire.
- **Internationalisation complète & thèmes** : suit le thème clair/sombre de DSH. À partir de la version d'hôte 0.2.2-rc.1, les 8 langues officielles (français, anglais, chinois, japonais, espagnol, allemand, russe, portugais) sont prises en charge nativement ; les hôtes antérieurs 0.2.0〜0.2.1 basculent de manière sécurisée en chinois et anglais.

## Aperçu de l'interface

### Question secondaire dans DSH

La conversation principale reste à sa place et la réponse secondaire s'affiche au-dessus de la zone de saisie.

![Bulle de réponse indépendante](https://raw.githubusercontent.com/MichengAI/dsh-btw/2d8dd7752cec1b29dd705969eaa932635ba0bf4f/assets/screenshots/btw-conversation.png)

### Menu de commandes

Tapez `/` et choisissez `btw` dans le menu des commandes, ou tapez directement `/btw votre question`.

![Entrée btw dans le menu de commandes](https://raw.githubusercontent.com/MichengAI/dsh-btw/2d8dd7752cec1b29dd705969eaa932635ba0bf4f/assets/screenshots/btw-command-menu.png)

### Bulles de réponse autonomes

Chaque question secondaire dispose de sa propre bulle avec des boutons en haut à droite pour copier, réduire/développer et fermer.

![Bulles de réponse multiples](https://raw.githubusercontent.com/MichengAI/dsh-btw/2d8dd7752cec1b29dd705969eaa932635ba0bf4f/assets/screenshots/btw-bubbles.png)

### Configuration des questions secondaires

Ouvrez **Plugins**, sélectionnez `@michengai/dsh-btw` pour afficher directement le formulaire de configuration sur la page détaillée : liste blanche des outils et invite personnalisée.

![Formulaire de configuration du plugin](assets/screenshots/btw-settings-panel.png)

### Générer des diagrammes

En ajoutant `pele_draw` à la liste blanche, la question secondaire peut également générer des diagrammes Mermaid dans son propre panneau sans modifier la conversation principale.

![Rendu de diagramme avec pele_draw](assets/screenshots/btw-pele-draw.png)

## Écosystème DeepSeek Harness

Pour utiliser l'espace de travail sur bureau, téléchargez [DSH Codex Desktop](https://github.com/MichengAI/dsh-codex-desktop/releases). Pour une installation existante de [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), installez les plugins selon vos besoins. Voici 11 plugins développés en interne ; le contenu réel de la version de bureau dépend des notes de version et du catalogue intégré correspondants.

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
- Compatibilité de l'hôte : série complète DeepSeek Harness `0.2.x` (`>=0.2.0-rc.1 <0.3.0-0`), validée sur `0.2.0-rc.1`, `0.2.0-rc.2`, `0.2.1-rc.1`〜`0.2.1-rc.5`, `0.2.2-rc.1`, `0.2.2-rc.2`, `0.2.2-rc.3`. Les mises à niveau de la même génération ne nécessitent pas de nouvelles versions du plugin.
- Support linguistique : l'ensemble des 8 langues intégrées est nativement sélectionnable à partir de DeepSeek Harness `0.2.2-rc.1`. Sur les hôtes `0.2.0`〜`0.2.1`, les dictionnaires supplémentaires enregistrés restent dormants et l'interface bascule de façon sécurisée en chinois et anglais.
- Les hôtes antérieurs à `0.2.0-rc.1` ne sont plus pris en charge. Les modifications destructives de la génération `0.3.0` sont interceptées par la barrière de version. Les utilisateurs de versions `0.1.x` doivent installer la version `0.1.24`.
- Node.js 22+, avec la commande `dsh` disponible dans le terminal.

## Installation

Les exemples ci-dessous utilisent le profil `web`. Adaptez-les selon votre environnement. Désactivez tout autre plugin fournissant la commande `/btw` avant l'installation.

### Installation assistée par Agent (Recommandé)

Transmettez ce message à un agent ayant accès au terminal local :

```text
Veuillez installer le plugin DSH @michengai/dsh-btw dans le profil web local en exécutant : dsh plugin --profile web add @michengai/dsh-btw@latest --registry=https://registry.npmjs.org/. Après l'installation, exécutez dsh --profile web --dump-config pour confirmer la présence de michengai-btw et expliquez-moi comment recharger DSH et commencer à l'utiliser.
```

### Installation manuelle via npm

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

dsh plugin --profile web add @michengai/dsh-btw@latest --registry=https://registry.npmjs.org/
```

### Rechargement

Installez ou mettez à jour après avoir terminé les tâches en cours. L'application de bureau peut se recharger automatiquement. Si les modifications ne s'appliquent pas, utilisez la fonction « Recharger » de l'application ou redémarrez le service `dsh web`. Actualiser le navigateur ne suffit pas.

Sur les hôtes antérieurs à `0.2.0` et sur `0.2.1` alpha, l'installation de `@latest` est rejetée par la barrière de version et le plugin ne s'exécutera pas. Pour `0.1.x`, installez `0.1.24`. Ce rejet ne supprime ni les configurations existantes ni l'historique des conversations.

## Utilisation

### Poser une question sur un texte sélectionné

Sélectionnez du texte dans un message de la conversation et cliquez sur « Poser une question sur ce texte » dans la barre flottante supérieure. Saisissez votre question et appuyez sur Entrée, ou cliquez sur « Expliquer cela ». Shift+Entrée pour un saut de ligne, Échap pour annuler. La réponse s'affiche dans une bulle dédiée BTW et la citation d'origine peut être dépliée.

- Prise en charge des paragraphes ordinaires, listes et blocs de code ; jusqu'à 8 000 unités de code UTF-16 par sélection (espaces compris). Tout dépassement est signalé sans tronquer le texte.
- La citation est figée lors de la sélection et ne change pas si la réponse continue de se générer. Le reste du contexte s'appuie sur le contenu finalisé au moment de l'envoi.
- Ne consomme ni ne vide le brouillon de la zone de saisie principale ; les sélections couvrant plusieurs messages, la zone de saisie ou les retours d'outils n'affichent pas ce menu.
- La barre propose également « Ajouter à la conversation », ajoutant la citation au brouillon existant et plaçant le focus sur la zone de saisie sans envoi automatique. L'ajout est suspendu pendant l'envoi d'un message. Le clic droit conserve le menu natif du navigateur.
- Prise en charge des sélections au clavier dans les éléments de texte ; relâcher Shift place le focus sur la barre. Les navigateurs sans support de l'API Popover basculent sur une couche fixe (fixed), susceptible d'être rognée par l'agencement de l'hôte.
- Séparation des zones avec `dsh-better-sidebar` : BTW ne traite que le corps de la conversation ; la prévisualisation de fichiers et l'éditeur conservent l'option d'origine « Ajouter à la conversation » du panneau latéral sans doublons.
- Les nouvelles entrées dépendent des balises DOM de l'hôte. Les agencements non reconnus conservent le comportement du clic droit d'origine et permettent toujours d'utiliser `/btw`.

### Poser une question via une commande

Dans une conversation disposant d'un contexte préalable :

```text
/btw Résume la solution précédente en une seule phrase
```

| Objectif | Action |
| --- | --- |
| Poser une question secondaire | Tapez `/btw votre question` et validez, ou choisissez `btw` dans le menu `/` |
| Consulter la réponse | Attendez l'apparition de la bulle dédiée au-dessus de la saisie |
| Copier la réponse | Cliquez sur l'icône de copie en haut à droite de la bulle |
| Réduire ou développer | Cliquez sur l'icône de pliage ou de dépliage en haut à droite |
| Annuler la question | Fermez la bulle pendant la génération (la tâche principale continue) |
| Supprimer la bulle | Fermez les bulles finalisées |
| Poser une autre question | Tapez à nouveau `/btw votre question` ; chaque question est indépendante |

Pour exécuter des commandes, modifier du code ou poursuivre la tâche principale, utilisez la conversation principale. BTW ne répond que sur la base du contexte existant.

BTW n'accepte que du texte. Si des images ou des fichiers sont attachés à la saisie, la question secondaire est refusée tout en conservant le texte et les pièces jointes ; retirez-les et réessayez.

### Instructions d'utilisation

- Chaque question secondaire est autonome et prend comme référence le contenu achevé de la session principale au moment de la demande ; elle n'inclut ni les réponses en cours ni les questions secondaires précédentes.
- Les bulles ne sont pas conservées après actualisation de la page ; copiez au préalable les réponses que vous souhaitez conserver.

## Configuration

Les deux options suivantes sont facultatives. Laisser les deux vides conserve le comportement par défaut : réponses textuelles uniquement avec l'invite intégrée.

Ouvrez **Plugins**, trouvez `@michengai/dsh-btw` et cliquez sur **Configuration**. L'emplacement correspond à celui de `dsh-subagent-default-model`.

| Paramètre | Description |
| --- | --- |
| **Outils autorisés** | Noms des outils autorisés en plus de `send_message`, un par ligne (ex. `pele_draw`). Laisser vide restreint aux réponses textuelles (valeur par défaut). |
| **Invite personnalisée** | Remplace l'invite intégrée. Pré-remplie avec le texte par défaut pour faciliter les ajustements ; enregistrer sans modification rétablit la valeur par défaut. |

Remarques :

- La liste blanche élargit uniquement ce que la question secondaire peut exécuter sans jamais restreindre la conversation principale ; renseigner un outil inexistant équivaut à ne rien autoriser.
- `send_message` ne peut pas être ajouté à la liste blanche. Le renvoi est uniquement autorisé vers la session parente de la question secondaire et ne peut pas être détourné vers un autre agent.
- L'invite personnalisée ne remplace que le préfixe d'instructions ; les explications sur les autorisations d'outils et le canal de retour sont toujours ajoutées à la fin pour éviter que le modèle ne s'attribue des droits inexistants.
- Les modifications s'appliquent dès la question secondaire suivante sans nécessiter de rechargement.
- La mention des outils autorisés dans les permissions modifie légèrement l'invite de la question. Intégrée dans le dernier message utilisateur, elle laisse les définitions d'outils et l'invite système identiques à l'octet près avec la session principale, préservant ainsi la réutilisation du prompt cache.

### Exemple : dessiner des diagrammes

[`dsh-pele`](https://github.com/hesheng01/dsh-pele) fournit l'outil `pele_draw`, qui convertit du code Mermaid en cartes de diagrammes SVG dans la session. En renseignant `pele_draw` dans les **Outils autorisés**, la question secondaire peut également produire des diagrammes.

> Remarque : `dsh-pele` est un plugin récent non publié sur npm et non répertorié sur le store. Il s'installe en clonant le dépôt GitHub et en ajoutant le dossier `plugin` à votre profil :
>
> ```bash
> git clone https://github.com/hesheng01/dsh-pele.git
> dsh plugin --profile <profile> add <chemin_absolu>/dsh-pele/plugin
> ```
>
> Un redémarrage du Host est nécessaire lors du premier ajout.

## Désinstallation

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

dsh plugin --profile web remove @michengai/dsh-btw
```

Prend effet après rechargement de DSH. La désactivation ou la mise à jour ne supprime aucun historique de conversation principale.

## Développement local

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
npm ci --ignore-scripts
npm run check
```

`npm run check` exécute la vérification de types, les tests et le build.

La version de référence pour le développement est `0.2.2-rc.3`. `npm run test:compat` compile avec cette référence et exécute la suite de tests sur chaque version isolée de l'hôte. Les tests de composants DOM ne remplacent pas la validation sur un navigateur réel.

GitHub et npm contiennent tous deux le dossier `lib` directement exécutable ; après modification du code source, exécutez `npm run build` avant de valider votre commit.

Pour installer depuis les sources, exécutez `dsh plugin --profile web add . --ignore-scripts` dans le répertoire du projet puis rechargez DSH.

## Licence

[Apache-2.0](LICENSE) © 2026 MichengAI.
