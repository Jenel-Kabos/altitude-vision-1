# Hôtellerie v2 (Sprint B2) — établissements, catégories, tarifs

**Statut : Sprint B2 — domaine Hôtellerie.** Un hôtel gère désormais son
établissement, ses catégories de chambres, ses plans tarifaires, ses
équipements/services, sa galerie et son statut de publication.
**Aucune réservation, aucune chambre physique (`Room`), aucun moteur de
disponibilité n'a été créé** — voir §9 (hors périmètre) et le futur
Sprint C.

---

## 1. Audit initial (avant modification)

### 1.1 `Hotel` (avant ce sprint)

Fiche d'établissement minimale : nom, description, étoiles, téléphone,
email, site web, `services: [String]` (texte libre), `hasRestaurant`/
`hasReception` (booléens isolés), `manager` (informatif, ne conditionnait
aucun droit), `property` (ancre), `status` (actif/inactif — filtre du
sélecteur admin uniquement). **Aucun cycle de publication propre** (pas de
brouillon/soumis/publié/rejeté/suspendu), **aucune galerie enrichie**,
**aucun score de complétude**, **aucun contact structuré**.

### 1.2 `hotelController`/`hotelRoutes` (avant ce sprint)

Deux endpoints seulement, tous deux réservés au staff (`ROLES_ALTIMMO`) :
`GET /api/hotels` (sélecteur admin, 200 max) et `GET /api/hotels/:id`.
**Aucune création directe** — un `Hotel` n'existait qu'en sous-produit de
`accommodationController.createFull`/`updateFull` (mode `hotelMode: 'create'`
ou `'existing'`, voir `buildHotelInput`), jamais comme domaine autonome.
**Aucun accès propriétaire** (le champ `manager` n'était vérifié nulle
part).

### 1.3 `Accommodation`/`RatePlan` — impact de ce sprint

`Accommodation.hotel` (référence conditionnelle) et
`Accommodation.HOTEL_ACCOMMODATION_TYPES` restent **inchangés** — le
mécanisme qui fait qu'un `accommodationType: 'hotel'` référence un `Hotel`
n'a pas bougé, et `accommodationService.isPubliclyVisible` (qui gouverne la
visibilité publique de l'annonce) n'a pas été modifié.

`RatePlan` référençait exclusivement `Accommodation` (`mode`
nightly/weekly/monthly/yearly) — **jamais directement `Hotel`**, contraire à
l'hypothèse initiale du sprint ("RatePlan ne doit plus être directement lié
à Hotel") : il n'y avait en réalité aucun couplage direct à défaire. Le
travail réel a consisté à **ajouter** une deuxième cible possible
(`RoomCategory` + `rateType`), de façon additive.

### 1.4 `PropertyForm`/`PropertyWizard` (avant ce sprint)

Depuis le Sprint B1, "Hôtel" avait été retiré de l'étape 2 du
`PropertyWizard` (hors périmètre B1). `PropertyForm.jsx` conservait
toutefois un bloc hôtel embarqué complet (`isHotelType`, sélecteur
existant/nouveau, champs `hotelName`/`hotelStarRating`/…) — accessible
uniquement en **édition** d'une ancienne annonce hôtel, ou en changeant
manuellement le `<select>` type après un choix Villa/Appartement/etc. via le
wizard.

### 1.5 Dashboard/pages publiques (avant ce sprint)

`ManageHotelsPage.jsx`, `HotelDetailPage.jsx`, `ManageRoomCategoriesPage.jsx`,
`ManageHotelRatesPage.jsx`, `MyHotelsPage.jsx` : tous des stubs
`ComingSoonPage` (Sprint 0, préparation de navigation uniquement — "Sprint
C"). **Aucune page publique dédiée aux hôtels** : un hôtel n'apparaissait
que comme carte individuelle dans le listing générique filtré
`?type=hotel`.

### 1.6 Duplications / responsabilités mal réparties identifiées

- Aucune duplication de champs Property (adresse/coordonnées/images)
  détectée dans `Hotel.js` — conforme dès l'origine.
- Le seul point de friction réel : la création d'un hôtel dépendait
  entièrement de la logique **Hébergement** (`accommodationController`),
  sans jamais exister comme flux autonome — corrigé par ce sprint via un
  domaine `hotelController`/`hotelService` dédié qui **réutilise**
  `accommodationService.createFullAccommodation` en interne (aucune
  duplication de la logique de compensation Property/Hotel/Accommodation
  déjà testée au Sprint Hôtel), sans dupliquer son code.

---

## 2. Décisions d'architecture

- **`Hotel` gagne son propre cycle de publication** (`publicationStatus`
  brouillon/soumis/publié/suspendu/rejeté + `active`), même forme que
  `Accommodation` (Sprint B1) — nécessaire pour un score de complétude et
  une modération dédiés à l'échelle de l'établissement (catégories/tarifs),
  pas seulement de l'annonce.
- **Double gate documentée, jamais ambiguë** : la visibilité PUBLIQUE de
  l'annonce reste governée à 100% par `accommodationService.isPubliclyVisible`
  (Property + `Accommodation.publicationStatus`/`active`, inchangé). Le
  nouveau cycle `Hotel.publicationStatus` gouverne le **domaine
  administratif** (dashboard/modération Hôtellerie) et est **synchronisé
  best-effort** vers l'Accommodation liée (`hotelService.
  syncLinkedAccommodations`) à chaque validation/rejet/suspension/
  réactivation — pour que les deux cycles ne divergent jamais silencieusement.
- **`RoomCategory` est un compteur d'unités, jamais une chambre identifiée**
  (`unitsAvailable: Number`) — aucune notion de numéro de chambre, d'étage,
  de calendrier ou de statut occupé/libre. Une future `Room` (hors
  périmètre) référencera cette catégorie.
- **`RatePlan` devient polymorphe de façon additive** : `accommodation`
  et `mode` redeviennent optionnels (au lieu de requis), `roomCategory` et
  `rateType` sont ajoutés, un hook `pre('validate')` impose "exactement une
  cible" (XOR). Zéro migration : tout `RatePlan` existant garde
  `accommodation`+`mode` et continue de fonctionner à l'identique.
- **Création dédiée via `HotelPropertyForm`**, jamais via le bloc hôtel
  embarqué de `PropertyForm.jsx` (conservé tel quel pour l'édition
  rétro-compatible des hôtels créés avant ce sprint). Le
  `PropertyWizard` réactive "Hôtel" à l'étape 2 — le choisir (au clic ou en
  changeant le `<select>` après un autre choix) affiche désormais
  `HotelPropertyForm` à la place de `PropertyForm`.
- **Deux scopes pour les mêmes contrôleurs** : `POST/PUT /api/hotels/admin*`
  (staff, peut assigner un `owner` arbitraire) et `POST/PUT /api/hotels/mine*`
  (propriétaire, `owner` toujours forcé à `req.user.id` — défense en
  profondeur contre une usurpation, testée).
- **Catégories/Tarifs gérés PAR établissement**, jamais comme listes plates
  globales — les anciennes routes stub `/dashboard/hotels/room-categories`
  et `/dashboard/hotels/rates` (Sprint 0) redirigent vers `/dashboard/hotels`
  (elles n'ont plus de sens sans `hotelId`).

---

## 3. Modèles

### 3.1 `Hotel` — champs ajoutés

```js
brand: String                          // enseigne commerciale
contact: { responsable, horaires, languesParlees: [String] }
hotelServices: { restaurant, bar, piscine, spa, salleSport,
                 salleConference, navette, parking, reception24h, wifi }  // Boolean
gallery: [{ url, type: 'photo'|'video', isCover, order, alt }]  // même structure qu'Accommodation.gallery (B1)
publicationStatus: enum('brouillon','soumis','publie','rejete','suspendu')
rejectionReason, suspensionReason, submittedAt, publishedAt, suspendedAt, reviewedBy
active: Boolean (default true)          // levier propriétaire
```
`services` (texte libre) et `hasRestaurant`/`hasReception` (legacy) sont
conservés tels quels — aucune perte de donnée, aucune migration.

### 3.2 `RoomCategory` (nouveau)

```js
hotel: ObjectId (ref Hotel, requis)
name, description
capacity: { maxAdults, maxChildren }
beds: Number
surface: Number (m², optionnel)
unitsAvailable: Number                  // COMPTEUR, jamais une liste de chambres
amenities: { cuisine, salon, internet, exterieur, parking, securite }  // [String] par catégorie, comme Accommodation (B1)
gallery: [...]                           // optionnelle, retombe sur la galerie de l'hôtel si vide
status: enum('actif','inactif')
```

### 3.3 `RatePlan` — extension additive

```js
accommodation: ObjectId | null          // optionnel désormais (était requis)
mode: enum(nightly,weekly,monthly,yearly) | null
roomCategory: ObjectId | null            // nouveau
rateType: enum(public,entreprise,weekend,promotion,haute_saison) | null  // nouveau
```
Hook `pre('validate')` : exactement une des deux paires
`(accommodation+mode)` XOR `(roomCategory+rateType)`, jamais les deux,
jamais aucune. Un seul tarif ACTIF par `(roomCategory, rateType)` (même
convention que `(accommodation, mode)`, Sprint 1.5/B1) — l'historique
(tarifs désactivés/archivés) est conservé, jamais supprimé.

---

## 4. Score de complétude Hôtel

`hotelService.computeHotelCompletionScore(hotel, property, categories, categoryRateCounts)`,
tout-ou-rien par catégorie :

| Catégorie | Poids | Condition |
|---|---|---|
| Informations | 20% | nom + description + téléphone + ville du Property renseignés |
| Galerie | 20% | `hotel.gallery` non vide OU Property.images ≥ 3 |
| Services | 20% | au moins un `hotelServices` à `true` |
| Catégories | 25% | au moins une `RoomCategory` active |
| Tarifs | 15% | **chaque** catégorie active a au moins un tarif actif |

**Gate de publication** : `PATCH /:id/validate` recalcule ce score et
renvoie **422** avec le détail (`breakdown`) si `score !== 100` — un hôtel
sans catégorie, ou dont une catégorie n'a aucun tarif, ne peut jamais être
publié.

---

## 5. Cycle de publication

```
brouillon → soumis → publié ⇄ suspendu
              ↓
            rejeté → (édition) → brouillon
```
Mêmes actions qu'Accommodation (B1) : `submit` (propriétaire, brouillon/
rejeté → soumis), `validate`/`reject` (staff, gate de complétude sur
validate), `suspend`/`unsuspend` (staff, motif requis), `deactivate`/
`reactivate` (propriétaire, bascule `active` sans changer
`publicationStatus`). Chaque transition staff synchronise best-effort
l'Accommodation liée (`syncLinkedAccommodations`).

---

## 6. API (endpoints créés)

| Méthode | Route | Rôle | Description |
|---|---|---|---|
| GET | `/api/hotels/public` | public | Liste des hôtels publiés (filtre ville/recherche) |
| GET | `/api/hotels/public/:id` | public | Fiche hôtel + catégories + tarifs actifs |
| POST/PUT | `/api/hotels/admin[/:hotelId]` | staff | Création/édition complète (HotelPropertyForm, dashboard admin) |
| GET | `/api/hotels/admin/list` | staff | Liste paginée/filtrée ("Établissements") |
| GET | `/api/hotels/status/pending` | staff | File de modération (galerie/catégories/tarifs/services) |
| POST/PUT | `/api/hotels/mine[/:hotelId]` | propriétaire | Création/édition ("Mes hôtels"), owner forcé à req.user.id |
| GET | `/api/hotels/mine` | propriétaire | Liste de ses hôtels |
| POST | `/api/hotels/:id/submit` | propriétaire | Soumission à validation |
| PATCH | `/api/hotels/:id/{validate,reject,suspend,unsuspend}` | staff | Décisions (gate complétude sur validate) |
| PATCH | `/api/hotels/:id/{deactivate,reactivate}` | propriétaire | Masquage temporaire |
| POST/DELETE | `/api/hotels/:id/duplicate`, `/api/hotels/:id` | propriétaire/admin | Duplication / suppression définitive |
| GET/POST/PATCH/DELETE | `/api/hotels/:hotelId/room-categories[/...]` | propriétaire/admin | CRUD catégories + dupliquer/activer/désactiver |
| GET/POST/DELETE | `/api/hotels/room-categories/:id/rate-plans[/:rateId]` | propriétaire/admin | Tarifs par type, historique, archivage |

`GET /api/hotels`, `GET /api/hotels/:id` (Sprint Hôtel) conservés à
l'identique pour compatibilité — le second exige désormais explicitement
manager OU staff (durci, l'ancien comportement laissait passer tout
utilisateur authentifié).

---

## 7. Dashboards

- **Admin — Établissements** (`/dashboard/hotels`, `ManageHotelsPage.jsx`) :
  onglets par statut (dont Suspendus), recherche, tri, pagination, actions
  rapides (valider/rejeter/suspendre/réactiver) avec score affiché.
- **Fiche établissement** (`/dashboard/hotels/[hotelId]`,
  `HotelDetailPage.jsx`) : score détaillé, liens Catégories/Tarifs, actions
  (soumettre/désactiver/dupliquer/supprimer).
- **Catégories** (`/dashboard/hotels/[hotelId]/room-categories`) : créer/
  modifier/supprimer/dupliquer/activer/désactiver.
- **Tarifs** (`/dashboard/hotels/[hotelId]/rates`) : par catégorie, 5 types
  de tarif, historique consultable, archivage.
- **Propriétaire — Mes hôtels** (`/mes-hotels`, `MyHotelsPage.jsx`) :
  création inline (`HotelPropertyForm` `scope="owner"`), mêmes actions de
  cycle de vie que l'admin.
- **Modération Hôtellerie** (`/dashboard/moderation/hotellerie`,
  `HotelModerationPage.jsx`) : galerie, catégories, tarifs, services et
  score affichés avant décision (même esprit que la modération Hébergement,
  Sprint B1).

---

## 8. Pages publiques

`Séjourner → Hôtels → Liste des hôtels → Détail hôtel` :
- `/immobilier/hotels` (`HotelsListingPage.jsx`) — liste publique filtrable
  par ville.
- `/immobilier/hotels/[hotelId]` (`HotelPublicDetailPage.jsx`) —
  présentation, galerie, services, catégories avec tarifs indicatifs,
  localisation, section "Avis" (placeholder texte, aucune donnée réelle).
  **Aucun moteur de réservation.**
- SEO : `buildHotelSchema` (nouveau, `client/lib/jsonld.js`, schema.org
  `Hotel`) + `buildBreadcrumb` (existant, réutilisé) ; OpenGraph/Twitter
  Cards/canonical via `buildMetadata` (existant, inchangé).
- `SejournerLandingPage.jsx` : la carte "Hôtels" pointe désormais vers
  `/immobilier/hotels` (au lieu du listing générique filtré `?type=hotel`).

---

## 9. Limites assumées avant le Sprint C

- **Aucune `Room`** (chambre physique), **aucune `Reservation`/`Booking`**,
  **aucun moteur de disponibilité/calendrier**, **aucun check-in/check-out**,
  **aucune facturation/housekeeping/PMS** — conformément à la contrainte
  explicite de ce sprint.
- **Avis clients** : placeholder texte uniquement sur la fiche publique,
  aucune collecte/affichage réel.
- **Filtres publics avancés** (prix, capacité, équipements) sur
  `/immobilier/hotels` : seul le filtre ville existe — même limitation
  assumée qu'au Sprint B1 pour l'hébergement indépendant.
- **`PropertyForm.jsx`** conserve son bloc hôtel embarqué (legacy) pour
  l'édition des hôtels créés avant ce sprint — aucune migration des
  données existantes n'a été effectuée ni requise.
- **Statistiques propriétaire** (vues, demandes) : toujours absentes,
  aucune infrastructure de tracking (même limitation qu'au Sprint B1).
