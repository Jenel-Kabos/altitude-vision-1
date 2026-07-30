# IM-2 — Décision d'architecture

## Cartographie auditée

- `Property` représente l'annonce et porte `status` (`vente`, `location`, `hebergement`), la modération, la publication et la disponibilité.
- `SaleManagement` et `RentalManagement` sont des satellites 1–1 contenant les règles propres à chaque filière.
- `Visite` possède déjà une machine d'état et un historique ; elle reste une référence facultative, jamais un prérequis artificiel.
- `Transaction` ouvre puis finalise le cycle de vente via FC-1. `Contrat` ouvre le bail et `RentalManagement` marque l'occupation à son activation.
- Les rôles immobiliers sont `Admin`, `GestionnaireImmobilier`, `Collaborateur`; le propriétaire ne peut agir que sur les dossiers de ses biens, le client uniquement sur ses dossiers.
- Les notifications persistantes disposent d'une clé de déduplication et de liens Web/mobile.
- Les documents génériques historiques exposent des URL. IM-2 ne les réutilise pas pour les justificatifs sensibles : seules des clés privées non sélectionnées par défaut sont conservées.

## Choix

Deux collections sont ajoutées : `RealEstateApplication` avec un discriminant métier (`purchase_offer`, `rental_application`) et `RealEstateReservation` (`sale`, `rental`). Les champs communs sont mutualisés, les sous-documents Vente et Location restent séparés. Aucun historique n'est embarqué uniquement dans `Property`.

`Property.reservationLock` est un cache/verrou de disponibilité, pas la source d'historique. `hasReservationHistory` interdit définitivement la suppression physique après la première réservation.

## Machines d'état

Application :

`submitted -> under_review -> accepted | rejected`

`submitted | under_review -> withdrawn | expired | not_selected`

Les états terminaux ne sont pas réouvrables. Une acceptation marque atomiquement les autres dossiers acceptables du même bien `not_selected`.

Réservation :

`active -> converted | cancelled | expired`

Une réservation terminale ne redevient jamais active. La conversion Vente exige la finalisation FC-1 ; la conversion Location exige l'activation du contrat.

## Invariants

1. Un dossier ne concerne qu'un bien publié, validé, disponible et de type compatible.
2. Le propriétaire ne peut être candidat de son propre bien.
3. Une offre est strictement positive ; la candidature limite les occupants, la durée et les données de revenu au strict nécessaire.
4. Un index partiel unique garantit une réservation `active` par bien. Application, réservation et clés d'idempotence ont leurs propres contraintes uniques.
5. L'acceptation en Replica Set utilise une transaction MongoDB. Le mode autonome est explicitement un fallback compensable : les index gagnent la course et les écritures créées sont annulées en cas d'échec.
6. Transaction et Contrat exigent la réservation active correspondante. Une finalisation/activation convertit celle-ci de manière conditionnelle et idempotente.
7. Expiration/annulation ne libère `Property` que si son verrou référence encore cette réservation ; une conversion ne peut donc pas être libérée par une course concurrente.
8. Les notifications sont produites après la fin de l'opération métier, avec `dedupeKey`.

## Sécurité documentaire

Les justificatifs acceptent uniquement PDF/JPEG/PNG, 10 Mio maximum. `storageKey`, revenus et pièces sont `select:false`. Aucune URL publique n'est produite. Un futur endpoint de téléchargement devra résoudre la clé privée après le même contrôle d'accès que le dossier ; le sprint ne crée pas de lien Cloudinary public pour ces pièces.

## Périmètre et compatibilité

FC-1 n'est pas refactoré : son service de finalisation ne reçoit qu'un invariant supplémentaire et convertit la réservation dans la même unité de travail. Les réservations hôtelières et d'hébergement restent totalement distinctes.
