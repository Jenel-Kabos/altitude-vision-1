# SECURITY-CLOSURE-P0-WAVE-1 — Périmètre exact du diff

HEAD avant/après : `a04055f62952c782b92aeef2f100824a17a5f645` (inchangé — aucun commit).

## Fichiers de code modifiés (6)

| Fichier | Lot(s) | Justification |
|---|---|---|
| `server/controllers/messageController.js` | P0-A | Remplace la vérification tenant-seule de `sendMessage` par `assertConversationAccess` |
| `server/routes/paiementRoutes.js` | P0-B, P0-C | Ajoute `requireTenantScopeForStaffOrPlatformOperator` sur `/`, `/stats`, `/alertes`, `/encaisser-multiple` |
| `server/controllers/paiementController.js` | P0-B, P0-C | Filtre tenant sur `getAll/getStats/getAlertes` ; vérification tenant sur `encaisserMultiple` |
| `server/routes/rentalLeaseLifecycleRoutes.js` | P0-D | Ajoute le `router.param('id', …)` tenant, verbatim depuis `contratRoutes.js` |
| `server/routes/adminRoutes.js` | P0-E | Ajoute `requireTenantScopeForStaffAllowPlatformWide` sur les 5 routes properties legacy |
| `server/controllers/adminController.js` | P0-E | Filtre tenant sur les listes ; `assertAdminPropertyTenantAccess` sur approve/reject/delete |

Aucun autre fichier de production modifié.

## Fichiers de test permanents créés (4)

- `server/__tests__/securityClosureP0WaveMessagingSendAuthority.mongo.integration.test.js` (13 tests)
- `server/__tests__/securityClosureP0WavePaiementTenantAuthority.mongo.integration.test.js` (9 tests — P0-B + P0-C, même domaine)
- `server/__tests__/securityClosureP0WaveLeaseLifecycleTenantAuthority.mongo.integration.test.js` (6 tests)
- `server/__tests__/securityClosureP0WaveAdminLegacyPropertyTenantAuthority.mongo.integration.test.js` (7 tests)

Total : 35 nouveaux tests permanents, tous prouvés rouge→vert (voir les 5 documents `_P0*_*.md`).

## Documents créés (15, y compris ce fichier)

`_BASELINE.md`, `_SOURCE_FINDINGS.md`, `_P0A_MESSAGING.md`, `_P0B_PAYMENT_READS.md`, `_P0C_BULK_COLLECTION.md`, `_P0D_LEASE_LIFECYCLE.md`, `_P0E_ADMIN_PROPERTY.md`, `_AUTHORITY_MATRIX.md`, `_SIDE_EFFECT_MATRIX.md`, `_P1_BACKLOG.md`, `_NEW_FINDINGS.md`, `_DIFF_SCOPE.md` (ce fichier), `_SECURITY_CLUSTER.md`, `_GATE_MATRIX.md`, `_DECISION.md`, `_REPORT.md` (les 4 derniers créés après les gates finaux).

## Ce qui n'a PAS été touché

- Frontend (`client/`) : aucune modification.
- Mobile (`altimmo-app/`) : aucune modification.
- Modèles Mongoose / schémas / migrations : aucune modification.
- Middleware autre que l'ajout d'imports/appels aux gardes déjà existants (`requireTenantScopeForStaffOrPlatformOperator`, `requireTenantScopeForStaffAllowPlatformWide`) — aucune nouvelle logique de garde inventée.
- Les 9 P1 et les dettes HZ-08/HZ-09/errorMiddleware : non corrigés (voir `_P1_BACKLOG.md`).
- `adminController.js`'s `adminStatus` (bug préexistant découvert fortuitement) : non corrigé (voir `_NEW_FINDINGS.md`).

## Note sur l'arbre de travail global

Le dépôt contenait déjà, avant ce sprint, un arbre de travail avec des modifications non commitées sans rapport (voir `_BASELINE.md`, héritage documenté depuis `HOTFIX_MESSAGING_MESSAGE_READ_AUTHORITY1_ETAT_INITIAL.md`). Ce sprint n'a ajouté strictement que les fichiers listés ci-dessus.
