# P0-B — Rental Payment Global Reads (RA-02)

## Rouge (avant correctif)

Suite `server/__tests__/securityClosureP0WavePaiementTenantAuthority.mongo.integration.test.js` (partagée avec P0-C), tests 1-5. Avec les correctifs de routes/contrôleur temporairement retirés : **8/9 tests du fichier ont échoué**, dont les 4 premiers tests P0-B (liste/stats/alertes/Admin B, tous exposant des données cross-tenant).

## Root cause

`paiementController.getAll/getStats/getAlertes` construisaient leur filtre uniquement à partir de `req.query` (`contrat`, `statut`, `annee`), sans aucune dimension tenant. `Paiement` n'a pas de champ `tenant` direct.

## Attribution canonique (piège évité)

Première tentative erronée : filtrer via `Property.find({tenant: req.platformTenant._id})` (champ dénormalisé). **Corrigé** après avoir constaté que la frontière tenant réellement utilisée par `assertResourceTenantOrUnattributed` (le garde canonique déjà en place sur les routes `:id` de ce même fichier) résout le tenant d'un Contrat via **l'appartenance (OrgMembership) du propriétaire du bien** (`Property.owner`), pas via un champ `tenant` littéral. Correctif final : réutilisation de la même primitive que `rentalManagementController.js` (`req.tenantScopeUserIds`, peuplé par `requireTenantScopeForStaffOrPlatformOperator`) : `Property.find({owner: {$in: req.tenantScopeUserIds}})` → `Contrat.find({bien: {$in: propertyIds}})` → filtre `Paiement`.

## Correctif

- `server/routes/paiementRoutes.js` : ajout de `requireTenantScopeForStaffOrPlatformOperator` sur `GET /`, `GET /stats`, `GET /alertes` (fail-closed pour tout staff/PO sans tenant résolu, même garde que HF-FINAL-01).
- `server/controllers/paiementController.js` : nouvelle fonction `scopedContratIdsForTenant(req)`, appliquée aux 3 handlers.

## Vert (après correctif)

**Tests 1 à 5 : 5/5 PASS** (liste scopée, stats scopées, alertes scopées, Admin B ne voit pas le tenant A, staff multi-tenant sans en-tête → 403).

## Statut : **CLOSED**
