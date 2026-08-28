# HOTFIX-ACCOMMODATION-CREATED-NOT-VISIBLE-1 — Flux tracé end-to-end

## 1. Formulaire de création (composant exact)

- Bouton "Ajouter un hébergement" dans `client/lib/pages/dashboard/ManageAccommodationsPage.jsx` (route `/dashboard/hebergements`, `client/app/dashboard/hebergements/page.jsx`).
- Ouvre `client/lib/components/dashboard/AccommodationPropertyForm.jsx` (modale).
- `submit()` construit un `FormData` (titre, description, prix, adresse, type d'hébergement, capacité, check-in/out, tarif nightly optionnel, équipements…) et appelle `createFullAccommodation(data)` (`client/lib/services/accommodationService.js:91`).
- Le payload ne contient **aucun** champ `publicationStatus`, `isApproved`, `status` (au sens modération) ni `owner` — confirmé par lecture exhaustive de la liste des clés envoyées.

## 2. Endpoint CREATE

- `POST /api/accommodations/admin` (`server/routes/accommodationRoutes.js:20`), `auth.restrictTo(...ROLES_ALTIMMO)` (Admin uniquement — `IAM-3` a retiré CommunityManager), `upload.array('images', 10)`, aucun middleware de tenant-scope sur cette route précise (contrairement à `/admin/list` et `/status/pending`, qui ont `requireTenantScopeForStaffAllowPlatformWide`).
- Contrôleur : `exports.createFull` (`server/controllers/accommodationController.js:889`).
  - `ownerId = mongoose.isValidObjectId(owner) ? owner : req.user.id` → toujours `req.user.id` (l'Admin lui-même) puisque le formulaire n'envoie jamais `owner`.
  - `buildPropertyData(req, ownerId)` → `Property.status = 'hebergement'` forcé, `statusAdmin` **non fixé explicitement** ici (valeur par défaut du schéma Property, hors périmètre de ce hotfix — le symptôme ne porte pas sur `statusAdmin`).
  - `buildAccommodationData(req)` → ne fixe jamais `publicationStatus`.
  - Appelle `createFullAccommodation(...)` du service.

## 3. Service `createFullAccommodation` (`server/services/accommodationService.js:230`)

1. `Property.create(propertyData)`.
2. `resolveHotel(...)` (type non-hôtel ici → `hotelId: null`).
3. `Accommodation.create({...accommodationData, hotel: null, property, createdBy: req.user.id, tenant})` — **`publicationStatus` non passé explicitement** → valeur par défaut du schéma appliquée : `'brouillon'`.
4. `RatePlan.create(...)` si tarif fourni.
5. **(avant ce hotfix)** retour immédiat, l'Accommodation reste en `'brouillon'`.
6. **(après ce hotfix)** `evaluateReadiness(accommodation, property)` — si prêt, `publicationStatus = 'soumis'`, `submittedAt = now`, `accommodation.save()`.

## 4. Valeurs par défaut du modèle `Accommodation` (`server/models/Accommodation.js:211`)

```js
publicationStatus: { type: String, enum: ['brouillon','soumis','publie','rejete','suspendu'], default: 'brouillon', index: true }
active: { type: Boolean, default: true }
```

## 5. GET du dashboard "Hébergements" (`/dashboard/hebergements`)

- `ManageAccommodationsPage.jsx:60` → `getAccommodationsAdmin({ status: 'publie', independentOnly: true, validatedOnly: true, activeOnly: true, ... })`.
- → `GET /api/accommodations/admin/list` → `exports.listAdmin` → `listAccommodationsForAdmin` (`server/services/accommodationService.js:491`) :
  - `status: 'publie'` → `query.publicationStatus = 'publie'`.
  - `validatedOnly: true` → exige `property.statusAdmin === 'Validée'` (match de population).
  - `activeOnly: true` → `query.active = { $ne: false }`.
  - `independentOnly: true` → `accommodationType !== 'hotel'` et `hotel: null`.
- **Un document `publicationStatus: 'brouillon'` ne passe jamais `query.publicationStatus = 'publie'`** → absent de la réponse → grille vide → message "Aucun hébergement validé".

## 6. Compteurs KPI ("Hébergements" = 1, "Publiés" = 0)

- `DashboardKpis` alimenté par `getDashboardAnalytics('accommodations')` → `GET /api/dashboard/analytics/accommodations` → `controllers/dashboardAnalyticsController.js:21-41`.
- Agrégation Mongo : `total: $sum 1` sur **tous** les hébergements indépendants du tenant (sans filtre de statut) ; `published: $sum (publicationStatus === 'publie')`.
- **Explique exactement le symptôme** : `total = 1` (le brouillon est compté), `published = 0` (il n'est pas encore publié) — aucune divergence de requête, c'est la même collection lue deux fois avec deux critères différents, tous deux corrects pour ce qu'ils mesurent.

## 7. Onglet "Modération Hébergements" (`/dashboard/moderation/hebergement`)

- `AccommodationModerationPage.jsx` → `getPendingAccommodations()` → `GET /accommodations/status/pending` → `exports.pending` (`accommodationController.js:517`) → `Accommodation.find({ publicationStatus: 'soumis', ... })`.
- **Un document `'brouillon'` ne passe pas non plus ce filtre** → absent de la modération.

## 8. Seule page où le brouillon était visible (avant ce hotfix)

- `client/lib/pages/dashboard/MyAccommodationsPage.jsx` (route `/mes-hebergements`) → `GET /accommodations/mine` → `Accommodation.find({ createdBy: req.user.id })`, **sans filtre de statut** — montre bien le brouillon, avec un bouton "Soumettre" (`submitAccommodation`).
- **Cette page n'est PAS liée dans la sidebar staff** (`client/lib/pages/dashboard/AdminDashboard.jsx` — seul `/dashboard/hebergements` y figure pour `ROLES_ALTIMMO`, jamais `/mes-hebergements`). Un Admin n'a donc **aucun chemin UI découvrable** pour soumettre un hébergement qu'il vient de créer via l'outil admin.

## 9. Comparaison avec le flux mobile analogue (preuve du contrat attendu)

`server/services/accommodation/mobileAccommodationPublicationService.js::createFullMobileAccommodation` — le point d'entrée structurellement équivalent ("création complète en un seul appel") pour l'app mobile — soumet **déjà** automatiquement à `'soumis'` immédiatement après création (dans la même transaction Mongo), avec la même garde `evaluateReadiness`. C'est la preuve directe que le contrat produit voulu pour ce type de point d'entrée ("staff/propriétaire publie directement, en un seul geste, un hébergement complet") est **auto-soumission à la modération**, jamais auto-publication ni blocage en brouillon invisible.
