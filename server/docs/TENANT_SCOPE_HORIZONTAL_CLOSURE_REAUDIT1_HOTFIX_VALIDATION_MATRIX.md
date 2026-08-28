# TENANT-SCOPE-HORIZONTAL-CLOSURE-REAUDIT-1 — Validation des hotfixs déjà certifiés

| Hotfix | Surface | Test permanent | Résultat re-exécuté | Régression | Verdict |
|---|---|---|---|---|---|
| HZ-01 | AccommodationReservation mutations tenant scope | inclus dans le cluster HZ (voir `_GATE_MATRIX.md`) | PASS | Non | RECONFIRMÉ VERT |
| HZ-02 | Accommodation Calendar/Blocks tenant scope | idem | PASS | Non | RECONFIRMÉ VERT |
| HZ-03 | AccommodationReservation admin list tenant scope | idem | PASS | Non | RECONFIRMÉ VERT |
| HZ-04 | Accommodation admin/pending lists tenant scope | idem | PASS | Non | RECONFIRMÉ VERT |
| HZ-05 | HotelReservation admin/pending lists tenant scope | idem | PASS | Non | RECONFIRMÉ VERT |
| HZ-06 | Hotel admin/portfolio/pending lists tenant scope | idem | PASS | Non | RECONFIRMÉ VERT |
| HZ-07 | Property moderation tenant scope | idem | PASS | Non | RECONFIRMÉ VERT (mais voir RA-09 : un chemin **legacy parallèle**, `adminController.js`, jamais couvert par ce hotfix, reste vulnérable sur le même modèle `Property`) |
| HF-FINAL-01 | Messaging staff tenant ambigu | `messagingTenantAmbiguousStaff.mongo.integration.test.js` | 24/24 PASS (via cluster ciblé, 50/50 avec les 2 autres suites) | Non | RECONFIRMÉ VERT (mais voir RA-01 : `sendMessage` n'a jamais reçu le contrat canonique, surface distincte de celle corrigée par ce hotfix) |
| RBAC-FINAL-01 | Accommodation availability-blocks RBAC/ownership | `accommodationAvailabilityBlocksRbac...test.js` | 12/12 PASS | Non | RECONFIRMÉ VERT |
| HOTFIX-MESSAGING-MESSAGE-READ-AUTHORITY-1 | `GET /api/messages/:conversationId` | `messageReadAuthority.mongo.integration.test.js` | 14/14 PASS | Non | RECONFIRMÉ VERT (mais voir RA-01 : le hotfix a corrigé exclusivement la lecture, jamais l'écriture `sendMessage`, dans le même fichier) |

## Conclusion de cette matrice

**Chacun des 10 hotfixs certifiés reste vert sur son périmètre exact et littéral** — aucune régression n'a été introduite ni détectée sur la surface qu'ils ont réellement corrigée. Ce qui a été découvert par ce re-audit n'est **pas** une régression de ces hotfixs, mais l'existence de **surfaces sœurs, non nommées par ces mandats**, présentant la même classe de vulnérabilité sur le même modèle de données ou le même domaine fonctionnel (HZ-07 ↔ RA-09 sur `Property` ; HF-FINAL-01/Message-Read-Authority ↔ RA-01 sur Messaging ; le principe TENANT-CERT-2 déjà appliqué à `contratRoutes.js`/`paiementRoutes.js` pour leurs routes `:id` ↔ RA-02/03/04/05 sur les routes de liste/mutation-multiple du même modèle). C'est exactement le mode de découverte que le mandat demandait explicitement de rechercher (§10 : « ne pas simplement rejouer les anciens tests »).
