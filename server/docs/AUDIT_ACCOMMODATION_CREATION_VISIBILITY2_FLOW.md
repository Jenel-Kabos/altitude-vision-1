# AUDIT-ACCOMMODATION-CREATION-VISIBILITY-2 — Flux

Audit read-only au HEAD `6214b77f7a43950218051227e99412cb5aadf7a4` (`main`). Version de production : **NON CONFIRMÉE**.

## Flux réellement utilisé par `/dashboard/hebergements`

```text
ManageAccommodationsPage
  → bouton « Ajouter un hébergement »
  → AccommodationPropertyForm.submit
  → createFullAccommodation(FormData)
  → POST /api/accommodations/admin
  → accommodationRoutes: protect + restrictTo + upload
     (pas de requireTenantScopeForStaffAllowPlatformWide)
  → accommodationController.createFull
  → buildBasePropertyData(..., status="hebergement")
  → accommodationService.createFullAccommodation
     1. Property.create(statusAdmin="En attente", sans tenant explicite)
     2. Hotel.create optionnel (types hôteliers seulement)
     3. Accommodation.create(property=<Property>, tenant=actingUser.platformTenant || null)
     4. RatePlan.create optionnel (prix nightly > 0)
     5. evaluateReadiness
        - prêt     → publicationStatus="soumis"
        - incomplet → publicationStatus="brouillon"
  → HTTP 201
  → toast « Hébergement créé. »
  → rechargement liste + analytics
```

La création standard indépendante produit donc 2 documents obligatoires (`Property`, `Accommodation`) et 0 ou 1 `RatePlan`. Un type hôtelier peut ajouter un `Hotel`. Les compensations suppriment les documents déjà créés si une étape obligatoire ou le tarif échoue. Le HTTP 201 atteste la persistance de la composition retournée, pas son éligibilité aux écrans.

## Routes de création présentes

| Route | Audience / middleware | Traitement | Ressources |
|---|---|---|---|
| `POST /api/accommodations/admin` | staff Altimmo; auth, rôle, upload; **pas de tenantContext** | `createFull` → `createFullAccommodation` | Property + Accommodation + RatePlan optionnel + Hotel optionnel |
| `POST /api/accommodations/mobile/full` | staff CM / Propriétaire | `createFullMobile` → service mobile atomique et idempotent | composition complète et soumission |
| `POST /api/accommodations` | utilisateur protégé propriétaire du Property ou Admin | `create` | Accommodation lié à un Property existant |

Le dashboard utilise exclusivement la première. Le hotfix historique est donc reachable : `POST /admin` traverse bien `createFullAccommodation` et son `evaluateReadiness`.

## Cycle et frontières de lecture

```text
création admin
  ├─ readiness KO → brouillon → ni liste principale, ni file de modération
  └─ readiness OK → soumis → file de modération tenant-scopée
                         └─ validate → publie

liste /dashboard/hebergements
  = tenant courant
  + publicationStatus publie
  + indépendant (type != hotel et hotel=null)
  + active != false
  + Property.statusAdmin Validée
```

La validation de l'Accommodation change seulement `Accommodation.publicationStatus` en `publie`; elle ne transforme pas la `Property.statusAdmin` créée à `En attente` en `Validée`. Il existe donc deux gates de modération distincts.

## Compteurs et portefeuille

| Surface | Chaîne | Définition réelle |
|---|---|---|
| `/dashboard/hebergements` liste | `GET /accommodations/admin/list` | publiés, actifs, indépendants, Property validée, tenant courant |
| `/dashboard/hebergements` KPI | `GET /dashboard-analytics/accommodations` | toutes les Accommodation indépendantes du tenant; sous-compteurs par publication |
| `/dashboard/properties` | `GET /properties/portfolio` | projection éligible et dédupliquée par Property : ventes/locations publiées, accommodations publiées et publiquement visibles, hôtels éligibles; scope propriétaires |
| `/dashboard` « Biens Altimmo » | `GET /dashboard/stats` | `Property.countDocuments()` global, sans tenant, pole, statut ni publication |

Une création admin indépendante ajoute normalement exactement **+1** au compteur général, car celui-ci compte uniquement la nouvelle Property. Il ne compte jamais l'Accommodation. Le passage observé de 2 à 4 ne peut pas provenir mathématiquement d'un seul appel normal : deux Property supplémentaires ou un état antérieur sont nécessaires. Leur origine exacte en production est **NON CONFIRMÉE**.

## Repères code

- Front : `ManageAccommodationsPage.jsx` fonctions `load`, `loadAnalytics`, formulaire lignes 60–71 et 405–407; `AccommodationPropertyForm.jsx` `submit`, lignes 48–84.
- Route : `routes/accommodationRoutes.js`, routes `/admin`, `/admin/list`, `/status/pending`.
- Création : `controllers/accommodationController.js:createFull` lignes 889–948; `services/propertyPublicationInputService.js:buildBasePropertyData` lignes 108–125; `services/accommodationService.js:createFullAccommodation` lignes 230–315.
- Readiness/visibilité : `services/accommodationService.js:evaluateReadiness`, `isPubliclyVisible`, lignes 30–74.
- Liste/modération : `services/accommodationService.js:listAccommodationsForAdmin`; `controllers/accommodationController.js:listAdmin`, `pending`, `reviewDecision`.
- KPI : `services/dashboardKpiQueryService.js:getDashboardKpis` lignes 7–22; `controllers/dashboardAnalyticsController.js:accommodations` lignes 21–47.

