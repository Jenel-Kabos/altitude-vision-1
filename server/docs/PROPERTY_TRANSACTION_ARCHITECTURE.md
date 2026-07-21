# Architecture Property par type de transaction (Sprint A)

## Contexte

Avant ce sprint, un seul formulaire (`PropertyForm.jsx`) et un seul modèle
généraliste (`Property`) portaient à la fois les règles de Vente, Location
et Hébergement, avec de nombreux champs conditionnels. Ce document décrit la
séparation introduite en Sprint A, première étape d'un chantier plus large
(Sprint B : Hébergement meublé dédié ; Sprint C : Hôtel/RoomType ; Sprint D :
dashboards ; Sprint E : pages publiques ; Sprint F : migration/nettoyage).

## Séparation des entités

- **`Property`** (`server/models/Property.js`) reste l'entité physique et
  commune : titre, description, adresse, ville, quartier, coordonnées GPS,
  images, propriétaire, `statusAdmin` (modération), `availability`, type
  physique, et `status` (`vente|location|hebergement`) — déjà le
  discriminant métier, aucun nouveau champ `transactionType` n'était
  nécessaire.
- **`SaleManagement`** (`server/models/SaleManagement.js`, **nouveau**) :
  satellite 1-1 (`property` unique) pour les règles propres à la vente —
  négociabilité, situation juridique, document de propriété (indicateur
  seulement, jamais le document lui-même), financement accepté, commission
  d'agence, conditions du vendeur, statut de publication. Aucun modèle
  existant ne couvrait cette responsabilité.
- **`RentalManagement`** (`server/models/RentalManagement.js`, **étendu**) :
  déjà utilisé par le module "Gestion Locative" existant (workflow actif —
  locataire, bail, préavis, sortie). Sprint A y ajoute les champs de FICHE
  d'annonce qui manquaient : `chargesIncluded`, `furnished`,
  `minimumLeaseMonths`, `availableFrom`, `petsAllowed`, `rentalConditions`,
  `cautionMultiplicateur`, `profilsLocataireRecherches`, `documentsRequis`.
  **Décision** : étendre ce modèle plutôt que créer un `RentalDetails`
  séparé (qui aurait dupliqué `monthlyRent` et cassé la promesse d'une
  source unique de vérité pour la location).
  **`managementActivated`** (Boolean, `default: true`) — ajouté lors de
  l'audit de sécurité de suivi : distingue une simple fiche d'annonce
  (`false`, créée via `POST /api/rental-properties`) d'un dossier de
  gestion locative réellement activé (`true`) — voir "Annonce vs bail actif"
  ci-dessous.
- **`Accommodation`** / **`Hotel`** : inchangés dans ce sprint (voir
  `HEBERGEMENT.md`).

## Compatibilité legacy — important

`Property.cautionMultiplicateur`, `Property.profilsLocataireRecherches` et
`Property.documentsRequis` **existent encore** sur le schéma `Property`
(annonces historiques créées avant ce sprint, et les flux legacy non
touchés : `POST/PUT /api/properties`, `PropertyForm.jsx`,
`OwnerPropertyManagement.jsx`, `MyPropertiesPage.jsx`). Ce sprint n'y touche
**pas** : ils continuent de fonctionner exactement comme avant. Seul le
NOUVEAU flux admin (`POST/PUT /api/rental-properties`) écrit désormais ces
informations sur `RentalManagement` plutôt que sur `Property`. Une migration
complète (retrait de ces champs de `Property`, mise à jour de tous les
points de lecture restants) est un chantier séparé, prévu au Sprint F.

De même, `Property.honoraires`/`Property.fraisVisite` restent partagés
Vente/Location/Hébergement (déjà génériques avant ce sprint) — non dupliqués
dans `SaleManagement`/`RentalManagement`.

**Priorité de fallback au chargement d'édition** (`propertyController.getProperty`,
`applyLegacyRentalFallback`) : pour `cautionMultiplicateur`,
`profilsLocataireRecherches`, `documentsRequis` — `RentalManagement` fait foi
si `managementActivated === true` (dossier réellement curaté) ; sinon, la
valeur legacy de `Property` est utilisée si elle est réellement définie
(non vide) ; sinon, la valeur par défaut du schéma `RentalManagement`. Ceci
évite qu'un `RentalManagement` auto-créé (valeurs par défaut) masque
silencieusement une vraie valeur historique saisie sur `Property`.

## Annonce simple vs dossier de gestion locative activé (audit de sécurité)

Une annonce Location créée via `POST /api/rental-properties` ne déclenche
**jamais** automatiquement de bail actif, de suivi de loyer, de pénalité, de
notification de locataire ou de statistique de gestion locative :

- `managementActivated: false` à la création (nouveau flux) — passé à
  `true` uniquement par une activation explicite : `rentalManagementController.create`
  (`POST /api/rental-management`, module "Gestion Locative" existant,
  inchangé) ou implicitement par `contratController.syncLeaseOccupation`
  dès qu'un `Contrat` de bail réel est créé pour la propriété.
- `rentalManagementController.list`/`stats` ne comptent/listent par défaut
  que les dossiers `managementActivated: true` — une simple annonce
  n'apparaît plus dans les compteurs du module Gestion Locative.
- `rentalFinancialAutomationService.js` (pénalités, échéances) ne
  sélectionne déjà que les `RentalManagement` avec `activeLease` renseigné
  (confirmé par audit) — un `RentalManagement` issu d'une simple annonce n'a
  jamais de `activeLease`, donc n'est structurellement jamais concerné.
- L'activation ultérieure (upsert par `property`, déjà idempotent) reste
  possible à tout moment sans dupliquer le document.

## Exposition publique (`GET /api/properties/:id`) — audit de sécurité

Cette route utilise `authController.optionalAuth` : **accessible sans
authentification**. `sale`/`rental` ne sont donc jamais renvoyés en
intégralité au public — `propertyController.serializeSalePublic`/
`serializeRentalPublic` réduisent chacun à une liste blanche explicite :

- **Vente (public)** : `negotiable`, `legalStatus`, `financingAccepted`.
  Exclus : `agencyCommission`, `sellerConditions`, `ownershipDocumentType`,
  `ownershipDocumentAvailable`, `manager`, `createdBy`, `updatedBy`,
  `publicationStatus`.
- **Location (public)** : `furnished`, `chargesIncluded`,
  `minimumLeaseMonths`, `availableFrom`, `petsAllowed`, `rentalConditions`.
  Exclus : `monthlyRent`, `charges`, `depositAmount`, `managementFee`,
  `currentTenant`, `activeLease`, `occupancyStatus`, `availabilityStatus`,
  `publicationStatus`/`publicationPolicy`/`publicationAuthorized`, `manager`,
  `mandateStartAt`/`mandateEndAt`, `maintenanceStatus`/`maintenanceReason`,
  `noticeStartedAt`/`plannedExitAt`/`exitInspectionClearedAt`,
  `publicationReadiness`, `workflowHistory`, `actionRequests`.

Le document complet (préremplissage d'édition dashboard) n'est renvoyé que
si `isAdmin || isOwner`. Tests dédiés :
`server/__tests__/propertyRoutes.test.js` (accès anonyme vs Admin
authentifié — la vulnérabilité initiale, où le document complet était
renvoyé sans distinction, a été détectée et corrigée pendant cet audit).

## Endpoints

| Route | Rôles | Description |
|---|---|---|
| `POST /api/sale-properties` | `ROLES_ALTIMMO` | Crée Property (`status=vente`) + SaleManagement |
| `PUT /api/sale-properties/:propertyId` | `ROLES_ALTIMMO` | Édite Property + SaleManagement existant |
| `POST /api/rental-properties` | `ROLES_ALTIMMO` | Crée Property (`status=location`) + RentalManagement |
| `PUT /api/rental-properties/:propertyId` | `ROLES_ALTIMMO` | Édite Property + RentalManagement existant |

**Écart volontaire par rapport à la mission** : les chemins suggérés
(`/api/admin/properties/sales`) auraient été masqués par les routes internes
déjà définies sous `/api/admin` par `adminRoutes.js`
(`GET /api/admin/properties` existe déjà). Espace de noms dédié choisi à la
place, cohérent avec les conventions déjà en place dans ce codebase
(`/api/accommodations`, `/api/hotels`).

Les anciennes routes (`POST/PUT /api/properties`) restent **inchangées** et
pleinement fonctionnelles — utilisées par le mobile, `OwnerPropertyManagement.jsx`,
`MyPropertiesPage.jsx`, et le flux Hébergement (toujours via
`POST/PUT /api/accommodations/admin`). Aucune route existante cassée.

`GET /api/properties/:id` embarque désormais `sale`/`rental` (selon
`status`), même convention que `accommodation` — utilisé pour le
préremplissage d'édition côté dashboard admin.

## Services backend

- `server/services/propertyTransactionService.js` (**nouveau**) : cœur
  partagé `createFullPropertyTransaction`/`updateFullPropertyTransaction` —
  Property + un seul satellite, avec compensation. Utilisé par
  `salePropertyService.js` et `rentalPropertyService.js` (tous deux
  nouveaux), structurellement identiques (contrairement à
  `accommodationService.js` qui garde sa propre logique à plusieurs étapes
  pour Hotel/RatePlan).
- `parseNumericField` et `buildBasePropertyData` ont été extraits de
  `accommodationController.js` vers `propertyController.js` (refactor pur,
  zéro changement de comportement, vérifié par les 368 tests serveur) pour
  être réutilisés par `salePropertyController.js`/`rentalPropertyController.js`.

## Compensation

Pas de transaction MongoDB (aucun précédent dans ce codebase — confirmé par
grep sur `startSession`/`withTransaction`, zéro résultat). Si le satellite
(SaleManagement/RentalManagement) échoue après la création de Property,
Property est supprimé et les images déjà uploadées vers Cloudinary sont
nettoyées. Chaque échec de suppression compensatoire est journalisé
(`utils/logger.js`) sans jamais masquer l'erreur métier initiale ni exposer
de détail interne au client.

## Formulaires frontend

- `client/lib/components/dashboard/SalePropertyForm.jsx` (**nouveau**) —
  self-contained (gère son propre état, contrairement à `PropertyForm.jsx`
  qui reçoit `formData`/`setFormData` de son parent). Sections :
  informations générales, localisation, caractéristiques physiques,
  situation juridique, prix et négociation, médias, publication. Aucun
  champ de loyer, tarif par nuit, type de chambre ni règle de check-in.
- `client/lib/components/dashboard/RentalPropertyForm.jsx` (**nouveau**) —
  même principe. Sections : informations générales, localisation,
  caractéristiques, loyer et charges, caution et avance, conditions du
  bail, disponibilité, médias. Aucun tarif hôtelier, aucun type de chambre.
- **Simplification assumée** : contrairement à la demande initiale
  d'extraire 5 sous-composants communs (`PropertyBasicInfoSection` etc.),
  ces deux formulaires restent autonomes avec leurs propres champs — la
  duplication réelle (titre/description/localisation/médias) est limitée
  et le gain de lisibilité d'une extraction n'était pas jugé proportionné
  au risque/temps pour ce sprint. Pas de sélecteur de carte Leaflet non
  plus (contrairement à `PropertyForm.jsx`) — champs latitude/longitude
  numériques simples, pour contenir le périmètre.
- `client/lib/pages/dashboard/ManagePropertiesPage.jsx` : le bouton
  "Ajouter" ouvre désormais un sélecteur métier à 3 cartes (Vente /
  Location / Hébergement meublé — la carte "Hôtel" viendra au Sprint C).
  Le choix détermine directement le formulaire, l'endpoint et le service
  appelés. `PropertyForm.jsx` (existant, `enableHebergement`) reste
  utilisé UNIQUEMENT pour la carte "Hébergement meublé" — comportement
  strictement inchangé pour ce chemin. En édition, le formulaire affiché
  dépend de `property.status` (`vente`→SalePropertyForm,
  `location`→RentalPropertyForm, `hebergement`→PropertyForm legacy).

## Pages orphelines constatées (non modifiées)

Audit confirmé : `client/lib/pages/dashboard/AddPropertyPage.jsx`
(route `/dashboard/properties/add`) et
`client/lib/pages/dashboard/AdminPropertyList.jsx` (route
`/admin/properties`) ne sont reliées à **aucun lien de navigation live** —
`AdminDashboard.jsx` ne pointe que vers `/dashboard/properties`
(`ManagePropertiesPage.jsx`). Le seul lien vers `/dashboard/properties/add`
provient d'`AdminPropertyList.jsx` lui-même, qui n'est atteignable par
aucune navigation. Ces deux pages sont **legacy/orphelines** : non
modifiées, non supprimées dans ce sprint (aucune preuve qu'elles servent
encore, mais suppression hors périmètre sans décision explicite).

## Permissions

Mêmes rôles que le reste du dashboard admin Altimmo : `ROLES_ALTIMMO`
(`Admin`, `Collaborateur`, `GestionnaireImmobilier`, `CommunityManager`) —
cohérent avec `accommodationRoutes.js`/`hotelRoutes.js`. Le module "Gestion
Locative" existant utilise `ROLES_GL` (périmètre différent : workflow actif
de bail, pas la création de fiche d'annonce) — non modifié.

## Formulaires — isolation et verrouillage du type (audit de sécurité)

`SalePropertyForm.jsx`/`RentalPropertyForm.jsx` sont montés/démontés
conditionnellement dans `ManagePropertiesPage.jsx` (jamais simultanément) —
changer de carte avant soumission détruit entièrement l'état du formulaire
précédent (composant React démonté), aucune fuite de champ possible entre
Vente et Location. En édition, aucun des deux formulaires n'expose de
sélecteur de statut/type : le type de transaction est donc structurellement
verrouillé, et un bandeau explicite ("Type de transaction : X — non
modifiable en édition") l'indique à l'utilisateur. Double-soumission
empêchée par `disabled={loading}` sur le bouton (même convention que
`PropertyForm.jsx`). Les erreurs serveur ne réinitialisent jamais le
formulaire (les données saisies restent modifiables et resoumissibles).
`price`/loyer strictement positif validé côté serveur (création et édition).

## Limites de ce sprint

- Pas de séparation des composants de section communs
  (`PropertyBasicInfoSection` etc.) — voir "Simplification assumée"
  ci-dessus.
- `Property.cautionMultiplicateur`/`profilsLocataireRecherches`/`documentsRequis`
  toujours présents sur le schéma `Property` (compatibilité legacy) — fallback
  de lecture implémenté (voir ci-dessus), mais pas de migration/suppression.
- Pas de sélecteur de carte interactive (Leaflet) dans les nouveaux
  formulaires.
- Pas de workflow de changement de type de transaction en édition
  (verrouillé, changement = suppression + nouvelle création).
- Hôtel/RoomType, dashboards réorganisés, pages publiques et migration des
  données existantes : hors périmètre, prévus aux sprints B à F.
