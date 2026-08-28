# SECURITY-CLOSURE-P0-WAVE-1 — Source de vérité (findings repris tels quels)

Reproduction fidèle des 5 findings P0 tels que documentés par `TENANT_SCOPE_HORIZONTAL_CLOSURE_REAUDIT1_FINDING_MATRIX.md`/`_DECISION.md` — aucun n'a été réinventé ou réinterprété.

| Lot | ID | Surface | Root cause (source) |
|---|---|---|---|
| P0-A | RA-01 | `POST /api/messages` (`sendMessage`) | Aucun `assertConversationAccess` — participant/staff non vérifié, tenant sans effet pour Client/Proprietaire |
| P0-B | RA-02 | `GET /api/paiements`, `/stats`, `/alertes` | Filtre `{}` sans dimension tenant |
| P0-C | RA-03 | `POST /api/paiements/encaisser-multiple` | `contrat`/`paiementId` pris du body, jamais vérifiés contre le tenant de l'acteur ; bypass du `router.param('id')` |
| P0-D | RA-05 | `rentalLeaseLifecycleController.*` (transition, renew, avenant, caution encaisser/bloquer/retenue/restituer) | Aucun `router.param('id')` tenant, contrairement à `contratRoutes.js` qui protège le même modèle `Contrat` |
| P0-E | RA-09 | `adminController.js` `/api/admin/properties*` (list/pending/approve/reject/**delete**) | Duplicata legacy de `propertyController.js`, jamais aligné sur `assertPropertyTenantAccess` ; DELETE non scopé |

Voir `TENANT_SCOPE_HORIZONTAL_CLOSURE_REAUDIT1_DECISION.md` pour le contexte complet (blast radius, hotfix recommandé par lot) et `_RUNTIME_REPRODUCTIONS.md` pour la preuve runtime déjà obtenue avant ce sprint sur RA-02/RA-03.
