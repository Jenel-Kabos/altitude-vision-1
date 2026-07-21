# Hébergement v2 (Sprint B1) — hébergement indépendant

**Statut : Sprint B1 — hébergement indépendant uniquement.** Villas,
appartements, studios, maisons, chambres d'hôtes, résidences meublées.
**Aucun hôtel, aucune chambre, aucune réservation, aucun calendrier n'a été
créé** — voir §8 (hors périmètre) et Sprint B2 à venir.

---

## 1. Audit initial (avant modification)

### 1.1 Modèle `Accommodation` (avant ce sprint)

Déjà présents et corrects, non retouchés dans leur logique : `property` (réf.
1-1, unique), `accommodationType` (10 valeurs enum), `hotel` (réf.
conditionnelle), `occupancyMode` (forcé par hook, hors périmètre B1),
`furnished`, `capacity.{maxAdults,maxChildren}`, `beds`, `checkInTime`/
`checkOutTime`, `minimumStay`/`maximumStay`, `cancellationPolicy`,
`securityDeposit`/`cleaningFee`, `currency`, `publicationStatus`
(brouillon/soumis/publie/rejete), `submittedAt`/`publishedAt`/`reviewedBy`.

**Champs inutilisés/insuffisants identifiés** :
- `houseRules: [String]` — texte libre non structuré, aucune règle
  exploitable (pas de filtre "animaux acceptés", pas d'affichage cohérent).
- Aucun champ équipements propre à l'hébergement — `Property.amenities`
  (texte libre générique, partagé Vente/Location/Hébergement) était la seule
  source, sans catégorisation ni filtre possible.
- Aucun champ services inclus (ménage, petit-déjeuner…).
- Galerie : aucune métadonnée au-delà de `Property.images` (pas de photo de
  couverture, pas d'ordre, pas de texte alternatif, pas de vidéo).
- `publicationStatus` n'avait pas de statut "suspendu" (retrait admin d'une
  annonce déjà publiée) — seul un cycle brouillon→soumis→publié/rejeté
  existait.
- Aucun score de complétude, alors que `evaluateReadiness` (existant)
  bloquait déjà la *soumission* sur des critères minimaux (type, capacité,
  horaires, chambres/sdb du Property) — mais rien n'empêchait techniquement
  un modérateur de *publier* une annonce sans photo ni tarif.

### 1.2 `RatePlan` — aucune modification nécessaire

Le modèle supportait déjà exactement ce que demande ce sprint : `mode`
(nightly/weekly/monthly/yearly), un seul tarif actif par
`(accommodation, mode)` (le service désactive l'ancien avant d'en créer un
nouveau — jamais de mutation en place), historique conservé (les tarifs
inactifs ne sont jamais supprimés). Aucun changement.

### 1.3 `PropertyForm.jsx` (avant ce sprint)

Formulaire à plat (aucune section/onglet/étape), 1087 lignes, bloc
Hébergement conditionné par `enableHebergement && status==='hebergement'`
(seul `ManagePropertiesPage.jsx`, dashboard admin, l'active — les
formulaires propriétaire ne l'ont jamais). Champs déjà couverts :
type, politique d'annulation, capacité, lits, horaires, séjour min/max,
caution, ménage, règles (texte libre), prix/nuit. **Absents** : équipements
structurés, services inclus, règles structurées, galerie avancée (ordre,
couverture, alt, vidéo).

### 1.4 `AccommodationController`/`AccommodationService` (avant ce sprint)

Couvraient déjà : création/édition propriétaire (`create`/`update`),
soumission (`submit`) avec `evaluateReadiness`, file de modération
(`pending`), décision admin (`reviewDecision`, validate/reject uniquement),
gestion des tarifs (`upsertRate`/`deactivateRate`/`listRates`), création/
édition complète dashboard admin (`createFull`/`updateFull`, avec
compensation orpheline Property/Hotel/RatePlan). **Manquant** : duplication,
suppression, désactivation propriétaire, listing admin filtré/paginé,
suspension/réactivation admin, score de complétude.

### 1.5 Routes — avant ce sprint

`POST /admin`, `PUT /admin/:propertyId`, `GET /status/pending`, `GET /mine`,
`POST /`, `GET /:id`, `PATCH /:id`, `POST /:id/submit`, `GET|POST /:id/rate-plans`,
`DELETE /:id/rate-plans/:rateId`, `PATCH /:id/:action` (validate/reject).
**Manquant** : `GET /admin/list`, `DELETE /:id`, `POST /:id/duplicate`,
`PATCH /:id/deactivate|reactivate`, actions `suspend`/`unsuspend`.

### 1.6 Dashboard — avant ce sprint

`MyAccommodationsPage.jsx` : configurer/modifier/soumettre/tarifs — mais
aucune action désactiver/dupliquer/supprimer, aucun score affiché, et un
sous-ensemble de champs différent de `PropertyForm.jsx` admin (incohérence :
pas de `cancellationPolicy`/`houseRules` ici). `AccommodationModerationPage.jsx` :
affichait type/capacité/chambres/horaires — **aucune photo, aucun tarif,
aucun équipement, aucun score de complétude**, avec un mapping de labels
dupliqué et incomplet (`ACCOMMODATION_TYPE_LABELS` local, absent de 4
valeurs de l'enum). **Aucune page admin "Tous les hébergements"** n'existait
(seule `AccommodationModerationPage` = file "soumis" uniquement, sans
filtre/recherche/tri/pagination).

### 1.7 Pages publiques — avant ce sprint

`AltimmoAnnonces.jsx` (listing) : filtres déjà présents (recherche, statut,
type **générique Property** (pas les types Hébergement), ville,
arrondissement, prix), pagination serveur. **Absents** : filtre capacité,
filtre équipements, vue carte. `PropertyDetailPage.jsx` : affichait déjà
formule/capacité/horaires/tarifs/caution/ménage/galerie simple/biens
similaires — **n'affichait jamais** règles de la maison, politique
d'annulation, ni équipements structurés/services inclus (ces champs
n'existaient pas encore côté modèle).

### 1.8 SEO — avant ce sprint

`buildMetadata` (`@/lib/seo`) gérait déjà OpenGraph/Twitter Cards/canonical
— réutilisable tel quel. JSON-LD `RealEstateListing` + `BreadcrumbList` déjà
générés pour toute fiche Property. **Aucun schema.org `VacationRental`**
n'existait.

---

## 2. Décisions d'architecture

- **`Property.amenities` (texte libre générique) n'est pas remplacé** —
  `Accommodation.amenities` (nouveau, structuré par catégorie) est un champ
  *additionnel*, propre à l'expérience "location courte durée". Les deux
  coexistent : `Property.amenities` reste affiché tel quel partout ailleurs
  (Vente/Location), `Accommodation.amenities` alimente les nouvelles vues
  Hébergement (fiche publique, modération, filtres).
- **Galerie** : pas de nouveau système de stockage — `Accommodation.gallery`
  ne fait que poser des métadonnées (ordre, couverture, alt, type
  photo/vidéo) sur les URLs déjà hébergées par `Property.images` via
  Cloudinary (aucune modification Cloudinary, conforme à la consigne). Si
  `gallery` est vide, l'affichage retombe sur `Property.images` tel quel —
  rétro-compatible avec tous les hébergements déjà publiés.
- **`suspendu` (admin) vs `active` (propriétaire)** : deux leviers distincts
  et volontairement séparés. `publicationStatus: 'suspendu'` est une action
  de modération (signalement, litige) réservée au staff (`ROLES_ALTIMMO`),
  réversible uniquement par un admin (`unsuspend`). `active: false` est un
  interrupteur propriétaire (masquer temporairement sans perdre le statut
  `publie` ni repasser par la modération) — réactivable à tout moment par
  le propriétaire lui-même. Les deux sont vérifiés indépendamment dans
  `isPubliclyVisible`.
- **Score de complétude tout-ou-rien par catégorie** (jamais de fraction
  partielle dans ce sprint) : plus simple à auditer et à tester, et
  suffisant pour bloquer une publication manifestement incomplète. Voir §4.
- **Le Property Wizard retire "Hôtel" et "Résidence hôtelière" de son étape
  2** (liste désormais limitée aux 6 types indépendants demandés). Le type
  `hotel` reste toutefois sélectionnable manuellement dans le `<select>` de
  `PropertyForm.jsx` (aucune régression du flux existant, testé) — seul le
  raccourci "sélection rapide" du wizard est retiré, en attendant le point
  d'entrée dédié du Sprint B2.
- **`residence_meublee` est repromue** de `LEGACY_ACCOMMODATION_TYPES` vers
  les types de premier rang, à la demande explicite de ce sprint.
- **Aucune nouvelle page carte** pour le listing public — voir §8
  (limitation assumée, documentée plutôt que bâclée).

---

## 3. Modèle de données

### 3.1 `Accommodation` — champs ajoutés

```js
amenities: {
  cuisine: [String], salon: [String], internet: [String],
  exterieur: [String], parking: [String], securite: [String],
}
rules: {
  petsAllowed: Boolean, partiesAllowed: Boolean, smokingAllowed: Boolean,
  childrenAllowed: Boolean (default true), minimumAge: Number,
}
includedServices: {
  menage: Boolean, petitDejeuner: Boolean, blanchisserie: Boolean,
  transfert: Boolean, cuisine: Boolean,
}
gallery: [{ url, type: 'photo'|'video', isCover, order, alt }]
active: Boolean (default true)               // levier propriétaire
publicationStatus: enum + 'suspendu'         // ajouté aux 4 valeurs existantes
suspensionReason, suspendedAt                 // miroir de rejectionReason/submittedAt
```

`houseRules` (texte libre) est conservé tel quel pour toute règle
additionnelle non couverte par `rules` — aucune perte de donnée, aucune
migration.

### 3.2 `RatePlan` — inchangé

---

## 4. Score de complétude

Calculé par `accommodationService.computeCompletionScore(accommodation, property, rates)`,
tout-ou-rien par catégorie :

| Catégorie | Poids | Condition |
|---|---|---|
| Informations | 20% | titre + description + type + capacité > 0 + chambres/sdb du Property renseignés |
| Photos | 20% | Property.images.length ≥ 3 |
| Tarifs | 20% | au moins un RatePlan actif avec montant > 0 |
| Équipements | 20% | au moins une valeur dans une catégorie `amenities` |
| Règles | 10% | checkInTime + checkOutTime renseignés |
| Services | 10% | au moins un `includedServices` à `true` |

**Gate de publication** : `PATCH /:id/validate` (staff) recalcule ce score
et renvoie **422** si `score !== 100`, avec le détail (`breakdown`) dans la
réponse — une annonce incomplète ne peut donc jamais être publiée, quelle
que soit l'interface appelante. Affiché dans `MyAccommodationsPage.jsx`
(propriétaire), `AccommodationModerationPage.jsx` et `ManageAccommodationsPage.jsx`
(admin).

---

## 5. Cycle de vie (publicationStatus)

```
brouillon → soumis → publié ⇄ suspendu
              ↓         
            rejeté → (édition) → brouillon
```

- `submit` (propriétaire) : brouillon/rejeté → soumis (bloqué si
  `evaluateReadiness` échoue — champs minimaux).
- `validate` (staff) : soumis → publié (bloqué si score de complétude < 100%).
- `reject` (staff, motif requis) : soumis → rejeté.
- `suspend` (staff, motif requis) : publié → suspendu.
- `unsuspend` (staff) : suspendu → publié.
- `deactivate`/`reactivate` (propriétaire) : bascule `active` sans toucher
  `publicationStatus` — un hébergement publié mais désactivé n'est plus
  visible publiquement (voir `isPubliclyVisible`) mais reste "publié" pour
  l'admin.
- `duplicate` (propriétaire/admin) : clone Property + Accommodation (repart
  en `brouillon`) + tarifs actifs. Images Cloudinary réutilisées telles
  quelles (mêmes URLs).
- `DELETE /:id` (propriétaire/admin) : suppression définitive
  (Accommodation + RatePlan + Property + images Cloudinary, best-effort).

---

## 6. API — endpoints créés (Sprint B1)

| Méthode | Route | Rôle | Description |
|---|---|---|---|
| GET | `/api/accommodations/admin/list` | staff | Liste paginée, filtrée (statut/type/recherche), triée |
| PATCH | `/api/accommodations/:id/deactivate` | propriétaire/admin | Masque temporairement (`active=false`) |
| PATCH | `/api/accommodations/:id/reactivate` | propriétaire/admin | Réaffiche (`active=true`) |
| POST | `/api/accommodations/:id/duplicate` | propriétaire/admin | Duplique en brouillon |
| DELETE | `/api/accommodations/:id` | propriétaire/admin | Suppression définitive |
| PATCH | `/api/accommodations/:id/suspend` | staff | Suspend une annonce publiée (motif requis) |
| PATCH | `/api/accommodations/:id/unsuspend` | staff | Réactive une annonce suspendue |

`PATCH /:id/:action` (existant) accepte désormais 4 actions :
`validate`, `reject`, `suspend`, `unsuspend`. Aucune route existante n'a été
supprimée ni renommée — compatibilité ascendante totale.

---

## 7. Dashboard

- **Admin** : nouvelle page `/dashboard/hebergements` (`ManageAccommodationsPage.jsx`,
  nav "Gestion hébergements" sous Immobilier) — onglets par statut (dont
  Suspendus), recherche, filtre type, tri (récent/ancien/prix), pagination,
  actions rapides (valider/rejeter/suspendre/réactiver) avec score de
  complétude affiché par annonce.
- **Modération** (`AccommodationModerationPage.jsx`) : affiche désormais
  photos, tarifs actifs, équipements, services inclus et score de
  complétude avant décision — le mapping de labels dupliqué/incomplet a été
  remplacé par la constante partagée `ACCOMMODATION_TYPES`.
- **Propriétaire** (`MyAccommodationsPage.jsx`) : ajout Désactiver/Réactiver/
  Dupliquer/Supprimer + badge de score de complétude + badge statut
  "Suspendu". Les statistiques de vues/demandes ne sont **pas** implémentées
  (aucune infrastructure de tracking des vues n'existe dans ce sprint — voir
  §8, limitation assumée).

---

## 8. Pages publiques

- Fiche hébergement (`PropertyDetailPage.jsx`) : nouvelles sections
  "Équipements de l'hébergement" (structurés), "Services inclus", "Règles de
  la maison" (dont politique d'annulation) — affichées uniquement si un
  profil Accommodation existe et contient des données, sans appel réseau
  supplémentaire (déjà embarqué dans la réponse publique de
  `GET /api/properties/:id`).
- SEO : `buildVacationRental(property, accommodation)` (nouveau,
  `client/lib/jsonld.js`) ajouté en complément du `RealEstateListing`
  existant sur les deux routes de détail (`/altimmo/property/[id]` et
  `/immobilier/property/[id]`, la seconde étant la route réellement liée
  depuis le header). OpenGraph/Twitter Cards/canonical/Breadcrumb
  réutilisent `buildMetadata` existant, inchangé.

---

## 9. Limites assumées avant le Sprint B2

- **Filtres publics avancés (capacité, équipements) et vue carte** sur le
  listing `/immobilier/annonces` : non implémentés. Filtrer par capacité/
  équipements exigerait une jointure Property↔Accommodation côté recherche
  (`getPropertiesWithFilters`), hors périmètre raisonnable de ce sprint sans
  risquer une régression sur la recherche générique Vente/Location déjà en
  production. Documenté ici comme dette explicite, pas oublié.
- **Statistiques propriétaire** (vues, demandes, taux de conversion) :
  aucune infrastructure de tracking n'existe — seul le score de complétude
  et le statut de publication sont affichés.
- **`OwnerPropertyManagement.jsx`** (page `/mes-biens`, plus ancienne, non
  auditée en profondeur) n'a reçu aucune des nouvelles fonctionnalités —
  seul `PropertyForm.jsx` (utilisé par le dashboard admin) porte les
  nouvelles sections. Un propriétaire crée/édite un hébergement via
  `/mes-hebergements` → `MyAccommodationsPage.jsx`, qui n'expose pas encore
  les champs équipements/services/règles/galerie (formulaire plus simple,
  capacité/horaires/tarifs uniquement) — à unifier dans un sprint dédié.
- **Hôtel/RoomCategory/Room/Reservation/Check-in/Check-out/Calendrier/PMS** :
  aucun n'a été créé, conformément à la contrainte explicite de ce sprint.
  `accommodationType: 'hotel'` reste utilisable (rétro-compatibilité), mais
  n'est plus mis en avant dans le Property Wizard.
