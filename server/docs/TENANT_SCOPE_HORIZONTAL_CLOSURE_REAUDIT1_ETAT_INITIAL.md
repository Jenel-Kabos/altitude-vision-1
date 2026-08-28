# TENANT-SCOPE-HORIZONTAL-CLOSURE-REAUDIT-1 — État initial

## Git

- HEAD : `a04055f62952c782b92aeef2f100824a17a5f645`
- Branche : `main`
- `git log -15 --oneline` : historique normal de commits applicatifs (`Update Altimmo NN`, `Update Mobile N`, `Update Img`) — aucun commit lié à la campagne Tenant Scope (confirmant qu'aucun hotfix précédent n'a été commité, conformément à la contrainte permanente de cette session).
- `git status --short` : 616 lignes (fichiers modifiés + non suivis), incluant l'arbre de travail pré-existant (~602 lignes documentées dans `HOTFIX_MESSAGING_MESSAGE_READ_AUTHORITY1_ETAT_INITIAL.md`) plus les 14 fichiers `HOTFIX_MESSAGING_MESSAGE_READ_AUTHORITY1_*` créés par le mandat précédent (2 controllers modifiés, 1 service créé, 1 test permanent créé, 10 docs créés) — cohérent avec l'attendu, aucune surprise.
- `git diff --stat` : 67 fichiers modifiés au global, 997 insertions / 522 suppressions — inclut le diff pré-existant + les 2 controllers de ce hotfix (`conversationController.js`, `messageController.js`).
- `git diff --check` : 4 avertissements CRLF pré-existants et inchangés (`conversationController.js`, `internalMailController.js`, `routes/emailRoutes.js`, `routes/messageRoutes.js`) — mêmes fichiers que la baseline précédente, aucun nouveau.

## Architecture

```
Architecture files analyzed: 473
Internal static edges: 1535
Known legacy debt:
- service → controller: 2
- controller → controller: 1
- route → model: 12 edges across 11 routes
- controller → model (progressive metric): 192
- known cycles: 0
Statically unresolved imports: 0
Dangling internal imports (progressive metric): 3
New violations: 0
Architecture boundaries: PASS
```

Identique à la baseline finale du hotfix précédent (`HOTFIX_MESSAGING_MESSAGE_READ_AUTHORITY1_GATE_MATRIX.md`) — cohérent avec le fait qu'aucun code n'a été modifié entre-temps.

## Contexte de campagne au moment de ce re-audit

10 mandats de la campagne Tenant Scope / RBAC / Resource Authority sont annoncés certifiés verts : HZ-01 à HZ-07, HF-FINAL-01, RBAC-FINAL-01, HOTFIX-MESSAGING-MESSAGE-READ-AUTHORITY-1. Ce mandat (`TENANT-SCOPE-HORIZONTAL-CLOSURE-REAUDIT-1`) est un audit **strictement read-only**, dont l'objectif explicite est de tenter activement d'invalider ces certifications plutôt que de les reconfirmer passivement — en cherchant des surfaces non encore nommées (routes oubliées, chemins alternatifs, endpoints frères, IDOR par ObjectId, fallbacks globaux, incohérences liste/détail/mutation, différences web/mobile).

## Mode opératoire

Conformément au mandat : aucune modification de code de production, de routes, de controllers, de services, de middleware, de modèles, de tests permanents, de frontend, de mobile, d'architecture ou de configuration. Seuls les documents `server/docs/TENANT_SCOPE_HORIZONTAL_CLOSURE_REAUDIT1_*` sont créés. Tout script/test temporaire de diagnostic sera supprimé avant STOP.
