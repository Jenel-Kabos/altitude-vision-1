# HOTFIX-USERS-COUNT-1 — État initial

Date : 2026-08-19. Branche `main`.

## 1. Baseline Git

```
git status --short → travail non commité de PAY-3/PAY-4 (financialRoutes.js, server.js, financialPaymentService.js modifiés + fichiers MTN/PAY nouveaux), rien lié à ce hotfix
git branch --show-current → main
git rev-parse HEAD → bfdd67c8f8293c690640fab799b2aae062196d7a
git diff --check → exit 0
```

`HEAD` inchangé depuis la fin de PAY-4. Aucune modification préexistante ne touche `User`, `Proprietaire`, les routes admin ou le dashboard utilisateurs.

## 2. Problème rapporté

`/dashboard/users` affiche `TOTAL: 1`, `ADMINS: 1`, `PROPRIÉTAIRES: 0`, un seul compte (Altitude Vision, Admin). Un second compte (`huinlogistics`) est pourtant authentifiable et accède à `/mes-biens` avec une interface propriétaire affichant "huinlogistics — Patrimoine".

## 3. Méthode

Audit en lecture seule exclusivement : aucune donnée de production consultée/modifiée directement (pas d'accès MongoDB de production dans cet environnement). L'investigation porte sur le code (modèles, routes, contrôleurs, requêtes Mongo, frontend) pour établir la cause structurelle, puis sur des tests avec fixtures locales pour la reproduire et vérifier le correctif — jamais sur la base réelle.

## 4. Plan

1. Tracer la route/contrôleur exacts derrière `/dashboard/users` (backend) et la page correspondante (frontend).
2. Identifier la requête Mongo finale et chaque filtre appliqué (tenant, rôle, statut).
3. Déterminer la sémantique réelle de l'onglet "Propriétaires" (`User.role` vs modèle `Proprietaire` vs autre).
4. Déterminer comment un compte accède à `/mes-biens` (quel rôle/modèle le permet) sans nécessairement apparaître dans `/dashboard/users`.
5. Construire la matrice de comparaison Altitude Vision vs huinlogistics à partir du code (pas de données réelles).
6. Classer la cause (A à I) uniquement après preuve.
7. Correctif minimal, tests IAM/cross-tenant, gates.

Aucune suppression/création d'utilisateur de production. Aucune migration. Aucune fusion User/Proprietaire sans preuve explicite de nécessité.
