# SECURITY-CLOSURE-P0-WAVE-1 — Matrice d'autorité (5 lots)

| Lot | Acteur | Tenant | Ressource | Résultat attendu | Preuve |
|---|---|---|---|---|---|
| P0-A | Client B (participant) | — | Conv privée B/C | Autorisé | test 4 |
| P0-A | Client A (non-participant) | — | Conv privée B/C | Refusé | test 1 |
| P0-A | Proprietaire A (non-participant) | — | Conv privée B/C | Refusé | test 2 |
| P0-A | Staff A (même tenant, non-participant) | Tenant A | Conv privée staffB/client | Autorisé (autorité staff tenant-wide préservée) | test 5 |
| P0-A | Admin A | Tenant A | Conv tenant A | Autorisé | test 6 |
| P0-A | PlatformOperator scopé A | Tenant A | Conv tenant A | Autorisé | test 7 |
| P0-A | Staff multi-tenant sans en-tête | Ambigu | Conv tenant A | Refusé (HF-FINAL-01) | test 8 |
| P0-A | Staff A | Tenant A | Conv tenant B | Refusé | test 9 |
| P0-B | Secretaire A | Tenant A | Liste Paiement | A uniquement | test 1 |
| P0-B | Admin B | Tenant B | Liste Paiement | B uniquement, jamais A | test 4 |
| P0-B | Secretaire multi-tenant sans en-tête | Ambigu | Liste Paiement | Refusé | test 5 |
| P0-C | Secretaire A | Tenant A | Encaissement Contrat A | Autorisé | test 7 |
| P0-C | Secretaire A | Tenant A | Encaissement Contrat B | Refusé | test 6, 8 |
| P0-D | Admin A | Tenant A | Transition/caution Contrat A | Autorisé | test 1, 4 |
| P0-D | Admin A | Tenant A | Transition/caution Contrat B | Refusé | test 2, 3 |
| P0-D | Staff multi-tenant sans en-tête | Ambigu | Transition Contrat A | Refusé | test 5 |
| P0-E | Admin A | Tenant A | Liste/pending/approve/reject/delete Property A | Autorisé | test 1, 6 |
| P0-E | Admin A | Tenant A | approve/reject/delete Property B | Refusé, Property B préservée | test 3, 4, 5 |
| P0-E | Staff multi-tenant sans en-tête | Ambigu | Liste/pending Property | Refusé | test 2, 7 |

## Règle Admin préservée (§24 du mandat)

Dans chaque lot, un Admin (ou staff équivalent) conserve l'intégralité de ses capacités CRUD légitimes **à l'intérieur de son propre tenant** — vérifié explicitement par un test dédié dans chaque suite (P0-A test 6, P0-D test 1/4, P0-E test 6). Aucun droit Admin n'a été retiré ; seule la frontière cross-tenant a été ajoutée.

## PlatformOperator (§25)

Seul P0-A expose une route déjà accessible à un PlatformOperator scopé (test 7) — confirmé inchangé. P0-B/C/D/E n'ont, avant comme après ce sprint, jamais offert de mode « PlatformOperator global » sur ces routes précises (aucune régression d'une capacité qui n'existait pas).
