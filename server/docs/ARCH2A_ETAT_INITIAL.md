# ARCH-2A — État initial

## Baseline Git

- Branche : `main`
- HEAD : `a04055f62952c782b92aeef2f100824a17a5f645` (`Update Altimmo 40`)
- Worktree avant intervention : propre (`git status --short`, `git diff --stat` et `git diff --check` sans sortie).
- Les dix derniers commits ont été inspectés, sans mutation Git.

## Sources ARCH-1

Les cinq livrables demandés (`ARCH1_REPORT.md`, `ARCH1_DOMAIN_MAP.md`, `ARCH1_DOMAIN_DEPENDENCY_MATRIX.md`, `ARCH1_FINDINGS.md`, `ARCH1_ROADMAP.md`) n'existaient pas dans `server/docs` au démarrage. ARCH-2A n'a donc pas refait l'audit : il s'appuie sur la baseline ARCH-1 certifiée fournie dans le mandat et la confronte au graphe courant.

## Outillage initial

Aucun `dependency-cruiser`, Madge, règle ESLint import/boundaries ni checker architectural réutilisable n'était installé. Les pipelines existants étaient `server/package.json` (`verify`, `ci`) et l'orchestrateur racine `scripts/local-ci.js`. Le choix retenu est un script Node natif, sans package npm supplémentaire.

## Mesure initiale normalisée

- 461 fichiers de production `.js`, `.cjs`, `.mjs` sous les couches contrôlées.
- 1 508 arêtes internes statiques normalisées et dédupliquées, dont trois imports internes pendants.
- 6 arêtes service → controller.
- 18 arêtes controller → controller.
- 17 arêtes route → model réparties sur les 13 fichiers route certifiés par ARCH-1. La différence entre « 13 routes » et « 17 arêtes » vient des routes important plusieurs modèles ; `projetsRoutes.js` vise en outre le fichier absent `models/Projet.js`.
- 202 arêtes controller → model, métrique progressive.
- Un cycle fort CRM/Marketing/Notification de huit fichiers.

ARCH-1 annonçait 1 526 dépendances avec sa méthode d'audit. Le checker opérationnel en compte 1 508 car il ne compte que les imports internes statiques normalisés, déduplique les couples source/cible et exclut commentaires, packages et code hors périmètre. Le volume global n'est pas un gate.
