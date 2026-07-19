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
- Chambres/hôtel (`RoomType`/`Room`), moteur de réservation réel, paiement, calendrier
  de disponibilité.
