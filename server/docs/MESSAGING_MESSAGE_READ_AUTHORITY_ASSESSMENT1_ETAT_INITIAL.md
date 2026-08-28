# MESSAGING-MESSAGE-READ-AUTHORITY-ASSESSMENT-1 — État initial

## Baseline git

- Branche : `main`
- HEAD : `a04055f62952c782b92aeef2f100824a17a5f645` (identique au HEAD connu des trois mandats précédents : HZ-01→HZ-07, HF-FINAL-01, RBAC-FINAL-01)
- `git status --short` : 590 lignes — arbre de travail non propre, cumul de sprints antérieurs non commités. Non touché.
- `git diff --check` : 4 avertissements CRLF pré-existants (`conversationController.js`, `internalMailController.js`, `emailRoutes.js`, `messageRoutes.js`), identiques à l'état connu, aucun nouveau.

## Architecture — baseline canonique

```
Architecture files analyzed: 472
Internal static edges: 1531
Known legacy debt: service→controller: 2, controller→controller: 1, route→model: 12/11, controller→model: 192
known cycles: 0
Statically unresolved imports: 0
New violations: 0
Architecture boundaries: PASS
```
Identique à l'état final des trois mandats précédents.

## Contexte certifié (rappel, non ré-audité, tenu pour acquis)

`HOTFIX-MESSAGING-TENANT-AMBIGUOUS-STAFF-1` (HF-FINAL-01) a fermé le contournement de frontière **tenant** sur la messagerie staff pour un contexte ambigu, en ajoutant `requireTenantScopeForStaffOrPlatformOperator` sur 7 endpoints. Pendant ce hotfix, un finding **distinct** a été observé sans être corrigé : `messageController.getMessages` (`GET /api/messages/:conversationId`) ne semble vérifier ni participant, ni staff, ni ownership — uniquement la frontière tenant (elle-même désormais gardée par le hotfix précédent). `RBAC-ACCOMMODATION-AVAILABILITY-BLOCKS-1` (RBAC-FINAL-01, domaine Accommodation, sans rapport direct) est également fermé.

## Portée de ce mandat

Caractériser (pas supposer) l'autorité de lecture réelle sur cet endpoint : tenant ≠ participant/ownership/staff authority. Déterminer si un utilisateur du bon tenant mais sans lien avec une conversation précise peut néanmoins la lire. Read-only strict — aucun correctif, seuls les documents `MESSAGING_MESSAGE_READ_AUTHORITY_ASSESSMENT1_*` peuvent être créés, et un test temporaire de reproduction si nécessaire, supprimé avant la fin.
