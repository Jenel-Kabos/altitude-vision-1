# HOTFIX-MESSAGING-TENANT-AMBIGUOUS-STAFF-1 — État initial

## Baseline git

- Branche : `main`
- HEAD : `a04055f62952c782b92aeef2f100824a17a5f645` (identique au HEAD connu de `TENANT-SCOPE-HORIZONTAL-FINAL-AUDIT-1`)
- `git status --short` : 562 lignes — arbre de travail non propre, cumul de sprints antérieurs non commités de cette session marathon. Non touché, non stashé, non nettoyé.
- `git log -10 --oneline` : historique récent normal (`Update Altimmo 40` en tête = HEAD), aucune anomalie.
- `git diff --check` : 3 avertissements CRLF pré-existants (`conversationController.js`, `internalMailController.js`, `emailRoutes.js`) — identiques à l'état connu, sans rapport avec ce hotfix.

## Architecture — baseline canonique

```
Architecture files analyzed: 472
Internal static edges: 1531
Known legacy debt: service→controller: 2, controller→controller: 1, route→model: 12/11, controller→model: 192
known cycles: 0
Statically unresolved imports: 0
Dangling internal imports: 3
New violations: 0
Architecture boundaries: PASS
```
Identique à l'état FINAL du dernier audit — aucune dérive avant même de commencer ce hotfix.

## Contexte certifié (rappel, non ré-audité, tenu pour acquis)

`TENANT-SCOPE-HORIZONTAL-FINAL-AUDIT-1` (verdict B) a démontré **HF-FINAL-01** en conditions réelles (HTTP + Mongo) : un staff membre de deux tenants, sans en-tête `X-Platform-Tenant-Id`, obtient un accès cross-tenant en lecture, suppression et écriture sur la messagerie partagée (`conversationController.js`). Root cause identifiée : `activeTenantId(req)` falsy → plusieurs fonctions traitent l'absence de tenant comme « rien à vérifier » au lieu de « refuser ». La route sœur `/count/unread` fail-close déjà correctement (403) le même scénario via `requireTenantScopeForStaffOrPlatformOperator`.

## Portée de ce mandat

Fermer HF-FINAL-01 par la correction la plus étroite possible, en réutilisant la frontière canonique déjà existante (celle qui protège `/count/unread`) plutôt qu'en inventant une nouvelle politique. Aucune modification RBAC, aucune modification de règle métier de messagerie, aucune modification frontend/mobile/schéma, aucune consolidation de release. RBAC-FINAL-01 (`availability-blocks`) et HZ-08/HZ-09 restent explicitement hors périmètre.
