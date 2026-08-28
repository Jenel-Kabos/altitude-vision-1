# P0-E — Legacy Admin Property (RA-09)

## Inventaire exact des routes (`server/routes/adminRoutes.js`)

| Méthode | Route | Handler | Confirmé live ? |
|---|---|---|---|
| GET | `/api/admin/properties/status/pending` | `getPendingProperties` | Oui — `server.js:410` monte `adminRoutes` sur `/api/admin` |
| GET | `/api/admin/properties` | `getAllProperties` | Oui |
| PATCH | `/api/admin/properties/:id/approve` | `approveProperty` | Oui |
| PATCH | `/api/admin/properties/:id/reject` | `rejectProperty` | Oui |
| DELETE | `/api/admin/properties/:id` | `deleteProperty` (hard-delete) | Oui |

## Consumers (recherche read-only, avant correctif)

`grep -rln "api/admin/properties" client/lib client/app altimmo-app/src` → **aucun résultat**. Aucune trace de consommation par le frontend web ou l'app mobile dans le code source (hors artefacts de build `.next`, qui référencent la page Next.js `/admin/properties`, une route **frontend** distincte, sans rapport avec cette API backend). Conclusion : routes legacy vraisemblablement mortes côté UI, mais **live** côté serveur — traitées avec le tenant-scope minimal (§22 du mandat : « le chemin le plus sûr reste généralement le tenant-scope minimal »), pas de suppression.

## Rouge (avant correctif)

Suite `server/__tests__/securityClosureP0WaveAdminLegacyPropertyTenantAuthority.mongo.integration.test.js`, 7 tests. Gardes retirés temporairement : **6/7 échoués** (liste/pending non filtrés, approve/reject/delete cross-tenant acceptés, staff multi-tenant non bloqué).

## Comparaison avec le flux Property canonique (HZ-07)

`propertyController.js` (`getAllProperties`/`getPendingProperties`) filtre déjà ses listes via `tenant: tenantId` (`Property.tenant`, peuplé à la création par les flux staff) derrière le garde `requireTenantScopeForStaffAllowPlatformWide`. `assertPropertyTenantAccess` (mutation) résout, elle, le tenant via l'appartenance du propriétaire (`tenantResourceAttributionService`).

## Correctif

- `server/routes/adminRoutes.js` : ajout de `requireTenantScopeForStaffAllowPlatformWide` (même garde que `GET /api/properties/status/pending`, HZ-07) sur les 5 routes.
- `server/controllers/adminController.js` : `getAllProperties`/`getPendingProperties` filtrent désormais par `tenant: req.platformTenant._id` (si résolu) ; `approveProperty`/`rejectProperty`/`deleteProperty` appellent une nouvelle fonction locale `assertAdminPropertyTenantAccess` (primitives `assertResourceTenantOrUnattributed` réutilisées directement, sans importer `propertyController.js` — pas de nouvel edge controller→controller).

## Hard-delete (test obligatoire du mandat, §23)

Test 5 : Admin A → `DELETE` sur Property B → refusé, `Property.findById(b.property._id)` non-null après la tentative (Property B préservée).

## Finding fortuit découvert (documenté, non corrigé)

`property.adminStatus` n'est pas un champ du schéma `Property` (voir `_NEW_FINDINGS.md`) — bug fonctionnel préexistant, sans rapport avec le tenant-scope, hors périmètre de ce sprint.

## Vert (après correctif)

**7/7 PASS.**

## Statut : **CLOSED**
