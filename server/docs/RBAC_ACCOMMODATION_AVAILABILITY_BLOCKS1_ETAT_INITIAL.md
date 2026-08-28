# RBAC-ACCOMMODATION-AVAILABILITY-BLOCKS-1 — État initial

## Baseline git

- Branche : `main`
- HEAD : `a04055f62952c782b92aeef2f100824a17a5f645` (identique au HEAD connu de `HOTFIX-MESSAGING-TENANT-AMBIGUOUS-STAFF-1`)
- `git status --short` : 577 lignes — arbre de travail non propre, cumul de sprints antérieurs non commités. Non touché.
- `git diff --check` : 4 avertissements CRLF pré-existants (`conversationController.js`, `internalMailController.js`, `emailRoutes.js`, `messageRoutes.js` — ce dernier introduit par le hotfix Messaging précédent, déjà connu). Aucun nouveau.

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
Identique à l'état final des deux mandats précédents.

## Contexte certifié (rappel, non ré-audité, tenu pour acquis)

`TENANT-SCOPE-HORIZONTAL-FINAL-AUDIT-1` a documenté **RBAC-FINAL-01** : `GET /accommodations/:id/availability-blocks` accessible à tout utilisateur authentifié, sans vérification d'ownership visible dans `listBlocks`/`authorizedCalendarAccommodation` pour un rôle non-staff — confirmé par lecture de code, jamais reproduit dynamiquement à ce stade (`STATICALLY_EXPLOITABLE`, pas encore `CONFIRMED_RUNTIME`). `HOTFIX-MESSAGING-TENANT-AMBIGUOUS-STAFF-1` (HF-FINAL-01) a fermé le finding Messaging séparé — non retouché ici.

## Portée de ce mandat

Recaractériser précisément (pas supposer) le contrat métier réel des availability blocks Accommodation, reproduire le gap RBAC en conditions réelles s'il est confirmé, puis appliquer le correctif le plus étroit possible sans toucher à la frontière tenant déjà certifiée par HZ-02. Si le contrat prouve que l'accès actuel est volontaire, ne pas corriger et reclassifier. `messageController.getMessages`, `errorMiddleware`, HZ-08, HZ-09 et toute consolidation de release restent explicitement hors périmètre.
