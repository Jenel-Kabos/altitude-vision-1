# TENANT-SCOPE-HORIZONTAL-FINAL-AUDIT-1 — Matrice des gates

| Gate | Commande | Résultat |
|---|---|---|
| A. Cluster HZ-01→HZ-07 | `npx jest --runInBand accommodationAdminListsTenantScope, accommodationCalendarTenantScope, accommodationReservationListTenantScope, accommodationReservationTenantScope, dashboardAnalyticsTenantScope, hotelAdminListsTenantScope, hotelReservationAdminListsTenantScope, propertyModerationTenantScope` | **8 suites / 137 tests — PASS** (dernier nombre connu : 123/123 ; l'écart de +14 provient de tests ajoutés par des sprints antérieurs non commités de cette session, pas d'une régression — nombre rapporté tel qu'observé, non forcé) |
| B. Tests security/tenant transversaux pertinents | Cluster ci-dessus + reproduction temporaire HF-FINAL-01 (supprimée avant STOP) | Cluster vert ; reproduction confirme HF-FINAL-01 (voir `_FINDING_MATRIX.md`) |
| C. Backend complet | `npm run test:unit` | **141 suites / 1579 tests — PASS** (identique au dernier nombre connu, 1579/1579, confirmé réel et non forcé) |
| D. Mongo exhaustif | `npm run test:mongo` | **109 suites / 1127 tests — 100% PASS** (durée 1398s ≈ 23min) — identique au dernier nombre connu (109/1127), confirmé réel, non forcé |
| E. Checker architectural (custom) | `npm run architecture:check` (état initial ET final) | **Identique avant/après — 472 fichiers, 1531 edges, 0 cycle, 0 unresolved, 0 nouvelle violation, PASS** (voir `_INITIAL_STATE.md`) |
| F. architecture:check | (même commande que E, gate demandé séparément par le mandat) | PASS, voir E |
| G. lint backend | `npm run lint` | **0 erreur**, 108 warnings — identiques au dernier état connu, aucun nouveau, aucun sur un fichier créé par cet audit (seuls des `.md` ont été créés, hors périmètre du lint JS) |
| H. git diff --check | `git diff --check` | 3 avertissements CRLF pré-existants (`conversationController.js`, `internalMailController.js`, `emailRoutes.js`), identiques à l'état initial — aucun nouveau |

## Verdict des gates

Toutes les portes de non-régression sont vertes (HZ cluster, backend complet, Mongo exhaustif à 100%, architecture stable, lint sans nouvelle erreur, diff-check sans nouvel avertissement). **Ceci ne change pas le verdict global de cet audit** : les gates de non-régression sont vertes, mais le critère de certification n°1 (aucune nouvelle fuite P0/P1 tenant-scope) n'est pas rempli à cause de HF-FINAL-01 — voir `_DECISION.md`. Un gate vert ne certifie que l'absence de régression sur les tests existants, pas l'absence d'un finding que ces tests ne couvraient pas (c'est exactement le rôle de cet audit).
