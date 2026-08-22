# HOTFIX-PROPERTY-APPROVED-VISIBILITY-ENDTOEND-1 — Matrice de visibilité

## État réel observé (AVANT réparation), preuve par test d'intégration Mongo
(`server/__tests__/propertyApprovedVisibilityEndToEnd.mongo.integration.test.js`, describe "Reproduction")

| Surface | Attendu (bien vente approuvé) | Actuel (document réel, `isPublished=false`) |
|---|---:|---:|
| Sales list | OUI | **NON** |
| Tous les biens | OUI | **NON** |
| Home Altimmo | OUI | **NON** |
| Rentals | NON | NON (conforme) |
| KPI Sales — total/actifs/brouillons | (dérivés, non filtrés par publication) | 1 / 1 / 1 — cohérent avec le contrat KPI |
| KPI Sales — publiés | 1 (si publié) | **0** |

## État après réparation via le vrai workflow (`PATCH /admin/:id/validate`)
(même fichier, describe "Réparation idempotente")

| Surface | Attendu | Après re-validation |
|---|---:|---:|
| Sales list | OUI | **OUI** |
| Tous les biens | OUI | **OUI** |
| Home Altimmo | OUI | **OUI** |
| Rentals | NON | NON |
| KPI Sales — publiés | 1 | **1** |
| Re-rejeu de `validate` (double clic) | idempotent | **idempotent, confirmé (1 seul item, jamais de doublon)** |
| `reject` explicite après coup | dépublie proprement | **`statusAdmin=Rejetée`, `isPublished=false`, absent du portefeuille** |

## Scénarios adversariaux (mandat Phase 8), tous prouvés par test

| Scénario | Attendu | Résultat testé |
|---|---:|---:|
| Vente approuvée + publiée | Sales OUI / Properties OUI / Home OUI / Rentals NON | ✅ conforme |
| Location approuvée + publiée | Rentals OUI / Sales NON | ✅ conforme |
| Vente approuvée mais non publiée | Home NON | ✅ conforme (cas réel) |
| Rejetée (même si `isPublished` forcé à `true` par erreur) | Home NON | ✅ conforme — `statusAdmin` reste le premier verrou |
| Brouillon (`En attente`) | Home NON | ✅ conforme |
| Type Parcelle | N'influence jamais vente/location | ✅ conforme — `Parcelle` testée en `location`, correctement classée côté Rentals, jamais Sales |
| Hotel/Accommodation | Jamais aspirés dans ce workflow classique | ✅ non concerné — `updatePropertyStatus` ne s'applique qu'aux `status ∈ {vente, location}` (`classicListing`), les hébergements gardent leur cycle `Accommodation`/`Hotel` séparé (déjà vérifié par `propertyPortfolio.mongo.integration.test.js`, rejoué vert) |
| Bien historique incohérent (`Validée` + `isPublished=false`) | Caractérisé explicitement | ✅ voir tableau "AVANT réparation" ci-dessus |

## Tenant

Aucune fuite cross-tenant testée ni observée dans ce sprint — le scope propriétaire (`ownerScope`/`expandScopeWithUnaffiliatedUsersIfSoleTenant`) n'a pas été modifié ; les tests de ce sprint utilisent `createTenantFixture` (tenant unique, admin bootstrap), cohérent avec les tests tenant déjà existants et rejoués verts (`tenantHardening.mongo.integration.test.js`, `propertyAssetRoutes.mongo.integration.test.js`).
