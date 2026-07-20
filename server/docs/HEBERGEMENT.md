# Hébergement (Sprint 2)

## Frontière Location / Hébergement

`Property.status` a une troisième valeur : `'hebergement'`. Elle désigne une occupation
par **réservation de séjour** (meublé, courte/moyenne durée), jamais par bail. Toute
logique propre au bail (Contrat, RentalManagement, cautionMultiplicateur,
profilsLocataireRecherches) doit tester `status === 'location'` explicitement et ne
jamais traiter `'hebergement'` comme un synonyme.

## Périmètre du Sprint 2

Logements meublés **entiers uniquement** (`occupancyMode: 'entire_place'`) :
villa_meublee, maison_meublee, appartement_meuble, studio_meuble, residence_meublee,
bungalow. Hors périmètre : hôtel/chambres, moteur de réservation, paiement, calendrier,
prévention de double-réservation, check-in/out réel.

## Modèles

- **`Accommodation`** (`server/models/Accommodation.js`) : satellite 1-1 de `Property`
  (unique sur `property`). Ne porte QUE ce qui n'a pas de sens pour Vente/Location :
  type d'hébergement, capacité, horaires, séjour min/max, caution de séjour, frais de
  ménage, `publicationStatus`. **bedrooms/bathrooms/amenities ne sont volontairement
  PAS dupliqués** — `Property` reste leur seule source de vérité (déjà affichés
  partout) ; `beds` (lits) est en revanche propre à l'hébergement et n'a pas
  d'équivalent Property.
- **`RatePlan`** (`server/models/RatePlan.js`) : tarifs versionnés par mode
  (`nightly/weekly/monthly/yearly`), un seul `active:true` par mode — les anciens sont
  désactivés (pas supprimés) à chaque mise à jour, ce qui conserve l'historique.

## Workflow de publication

`Accommodation.publicationStatus` : `brouillon → soumis → publie | rejete`, et
`rejete → brouillon` automatiquement à toute édition du propriétaire (republier repasse
par `/submit`). Ce statut est **additif** à `Property.statusAdmin` (inchangé) : un
hébergement n'est visible publiquement que si les DEUX conditions sont réunies
(`accommodationService.isPubliclyVisible`). La soumission exige des données complètes
sur l'Accommodation (type, capacité, horaires) **et** sur la Property (bedrooms,
bathrooms > 0) — voir `evaluateReadiness(accommodation, property)`.

## Création/édition depuis le dashboard admin

`POST /api/accommodations/admin` et `PUT /api/accommodations/admin/:propertyId`
(rôles `ROLES_ALTIMMO` : Admin, Collaborateur, GestionnaireImmobilier,
CommunityManager) créent/mettent à jour **en un seul appel** les trois entités
(Property + Accommodation + RatePlan nightly optionnel) depuis
`ManagePropertiesPage.jsx` (formulaire admin, `PropertyForm.jsx` avec le prop
`enableHebergement`). `Property.status` est toujours forcé à `'hebergement'`
côté serveur, jamais accepté depuis le client.

**Différence avec la création propriétaire** : le flux propriétaire
(`POST /api/accommodations`, `/mes-hebergements`) reste en 2 étapes — créer la
Property via le formulaire générique, puis configurer l'Accommodation
séparément. Le flux admin fait les deux en une seule requête, pour permettre
à un admin de créer un hébergement complet pour le compte d'un tiers sans
allers-retours.

**Payload** (multipart) : champs Property identiques à `POST /api/properties`,
plus `accommodationType`, `capacity[maxAdults]`, `capacity[maxChildren]`,
`beds`, `checkInTime`/`checkOutTime` (format `HH:MM` strict), `minimumStay`/
`maximumStay`, `cancellationPolicy`, `houseRules`, `securityDeposit`,
`cleaningFee`, `nightlyPrice` (optionnel — aucun RatePlan créé si absent), et
— uniquement si `accommodationType === 'hotel'` — `hotelMode`
(`'existing'|'create'`) plus `hotelId` ou `hotelName`/`hotelDescription`/
`hotelStarRating`/`hotelPhone`/`hotelEmail`/`hotelWebsite`/`hotelServices`/
`hotelHasRestaurant`/`hotelHasReception` (voir "Sprint Hôtel" ci-dessous).

**Compensation** (pas de transaction MongoDB — aucun précédent dans ce
codebase) : si Accommodation échoue après la création de Property (et d'un
éventuel Hotel), Property (et le Hotel s'il vient d'être créé) est supprimé ;
si RatePlan échoue après Accommodation, Accommodation, Property et un Hotel
nouvellement créé sont supprimés. Les images déjà uploadées vers Cloudinary
sont aussi nettoyées dans ces deux cas. Toute valeur numérique/horaire
invalide (NaN, format horaire incorrect, `maximumStay < minimumStay`) est
rejetée en 422 **avant** tout accès base — voir
`parseNumericField`/`parseTimeField` dans `accommodationController.js`.
Chaque suppression compensatoire est *best-effort* (`compensateDelete` dans
`accommodationService.js`) : un échec de compensation (Property/Accommodation/
Hotel non supprimé, ou nettoyage Cloudinary) est journalisé via
`utils/logger.js` mais ne masque jamais l'erreur métier initiale renvoyée au
client — jamais de détail interne de compensation dans la réponse HTTP.

En édition, l'Accommodation existante est mise à jour (jamais dupliquée) et
un nouveau tarif nightly désactive l'ancien plutôt que d'en créer un doublon
— même convention que `upsertRate`.

## Sprint Hôtel — établissement (`Hotel`)

Ajoute la distinction entre le bien physique (`Property`), l'usage hébergement
(`Accommodation`) et — quand `accommodationType === 'hotel'` — l'établissement
hôtelier lui-même (`Hotel`, `server/models/Hotel.js`), qui existe en dehors de
tout `Property` particulier (un même hôtel pourrait à terme être associé à
plusieurs bâtiments). `Accommodation.hotel` référence l'établissement ;
`null` pour tous les autres `accommodationType`, y compris `chambre_hotes` et
`residence_hoteliere` qui n'exigent volontairement pas de fiche `Hotel` dans
ce sprint (`Accommodation.HOTEL_ACCOMMODATION_TYPES = ['hotel']`).

`ACCOMMODATION_TYPES` est étendu à : `hotel`, `appartement_meuble`,
`maison_meublee`, `villa_meublee`, `residence_hoteliere`, `chambre_hotes`,
`studio_meuble`, `autre`. Les valeurs historiques `residence_meublee` et
`bungalow` (Sprint 2) restent acceptées par le schéma pour les documents
existants — lisibles, modifiables sans transformation silencieuse, une
sauvegarde sans changement de type ne les efface pas — mais ne sont plus
proposées à la création : côté client, `constants/accommodation.js` les
isole dans `LEGACY_ACCOMMODATION_TYPES`, que `PropertyForm.jsx` ne réinjecte
dans le `<select>` que si c'est la valeur déjà en base pour l'annonce en
cours d'édition.

**`GET /api/hotels`** / **`GET /api/hotels/:id`** (rôles `ROLES_ALTIMMO`) :
liste/consultation pour le sélecteur "Établissement hôtelier" du dashboard
admin — pas de dashboard de gestion hôtelière dédié, pas de suppression.

**Résolution de la référence Hotel** (`accommodationService.resolveHotel`) :
- `hotelMode: 'existing'` → l'Hotel doit exister réellement (référence
  arbitraire/inexistante refusée en 422) ; **n'est jamais supprimé par la
  compensation**, quel que soit l'endroit où l'échec survient — l'admin l'a
  sélectionné, pas créé.
- `hotelMode: 'create'` → crée un Hotel minimal (nom requis, email/étoiles
  validés) rattaché au `Property` en cours de création ; celui-ci **est**
  compensé (supprimé) si une étape suivante échoue.

**Édition** : changer d'établissement remplace la référence sans jamais
supprimer l'ancien Hotel (il peut être réutilisé ailleurs). Si le type change
vers un type non-hôtel, `accommodation.hotel` est remis à `null` ; si plus
aucun Accommodation ne référence l'ancien Hotel, `hotelOrphaned: true` est
renvoyé dans la réponse — signal informatif uniquement, aucune suppression
automatique.

**`occupancyMode`** : `'entire_place'` pour les logements meublés classiques,
forcé à **`'room_based'`** pour `accommodationType: 'hotel'` — un hôtel n'est
normalement pas réservé comme un tout, contrairement à une villa/maison
meublée. Ce champ n'est lu par aucune logique existante (recherche,
tarification, affichage, réservation — vérifié par grep) : `'room_based'`
signifie seulement que la disponibilité/réservation sera portée par une
future entité Room/Unit, jamais par `Accommodation`/`Hotel` eux-mêmes.
Un `Hotel` est un **établissement**, pas une chambre réservable ; c'est cette
future entité Room/Unit qui sera l'entité réservable — voir "Hors périmètre"
ci-dessous. L'invariant est appliqué par un hook `pre('validate')` sur le
schéma `Accommodation` (jamais laissé à la charge du contrôleur/service), de
sorte qu'il tienne quel que soit le point d'entrée. Un second hook de schéma
exige par ailleurs `Accommodation.hotel` non-null dès que
`accommodationType==='hotel'` (défense en profondeur, en plus de la
validation déjà faite par `buildHotelInput`).

**Hors périmètre de ce sprint** (voir Étape 11 de la mission) : gestion des
chambres/unités, disponibilité par chambre, calendrier hôtelier, check-in
opérationnel, restaurant/commandes, personnel hôtelier, réservation
multi-chambres, paiements.

## Limitations actuelles

- Filtrage de visibilité en listing public (`getAllProperties`) appliqué **après**
  pagination Mongo : `total` peut être légèrement surestimé et une page peut contenir
  moins de `limit` résultats si elle incluait des hébergements non publiés. Aucun
  impact sur Vente/Location. Voir commentaire dans `propertyController.js`.
- Pas de création d'Accommodation côté mobile (web uniquement, `/mes-hebergements`).
- Pas de bouton de réservation, pas de calendrier, pas de paiement.

## Sprint 3 (recommandations)

- Agrégation `$lookup` Property↔Accommodation pour un filtrage/pagination exacts.
- Écran mobile de création/édition d'Accommodation.
- Gestion des chambres/unités (`RoomType`/`Room`, satellites de `Hotel`), disponibilité
  par chambre, calendrier hôtelier, moteur de réservation réel, paiement.
