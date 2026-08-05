# Sprint ACC-MOBILE-1 — Audit initial

## Périmètre audité

Audit réalisé avant toute modification fonctionnelle sur le Backend, le Web de référence, le Mobile, NAV-CORE, FC-1, DOC-EVO et le moteur dossier.

## Cartographie Backend

### Réservation Accommodation

Toutes les routes sont déjà protégées par authentification dans `accommodationReservationRoutes` :

| Besoin Mobile | API existante | Autorité |
|---|---|---|
| Créer une demande | `POST /api/accommodation-reservations` | `accommodationReservationService.create` |
| Lister mes séjours | `GET /api/accommodation-reservations` | portée voyageur/propriétaire/staff dans le contrôleur |
| Détail | `GET /api/accommodation-reservations/:id` | participant ou staff |
| Annuler | `POST /api/accommodation-reservations/:id/cancel` | transitions ACC-1 |
| Disponibilité et devis | `GET /api/accommodations/:id/availability` | calcul `quote` côté serveur |
| Paiements | `GET /api/accommodation-reservations/:id/financial-summary` | FC-1, participant ou staff |
| Remboursements | `GET /api/accommodation-reservations/:id/refundable-summary` | FC-1, participant ou staff |
| Demander un remboursement | `POST /api/accommodation-reservations/:id/refunds` | FC-1, voyageur ou finance |

Le serveur valide seul publication, activité, capacité, dates, disponibilité concurrente, tarif actif, transitions, total, solde, statut de paiement, idempotence et montant remboursable. Les paiements Accommodation sont manuels et réservés aux rôles comptables ; le voyageur consulte leur état et peut demander un remboursement éligible, sans simuler d'encaissement Mobile.

### Documents

La confirmation crée et émet déjà une `FinancialDocument` Accommodation via `accommodationBillingService.ensureAccommodationInvoice`. Les paiements et remboursements sont rattachés à ce document. Les routes DOC-EVO génériques de lecture/statut/téléchargement PDF existent, mais leur contrôle d'accès est actuellement couplé au périmètre Hôtel. L'écart à corriger est donc l'autorisation du document Accommodation pour le voyageur, le propriétaire ou le staff déjà autorisé sur la réservation, sur les endpoints existants uniquement.

### Dossiers

Le registre dossier traite déjà les hébergements via `hebergementHotelDossierAdapter`. Aucun nouveau dossier, statut ou moteur d'action n'est requis pour le parcours voyageur.

### Notifications

Les producteurs ACC-1 émettent notamment `accommodation_reservation_pending`, `accommodation_reservation_confirmed`, `accommodation_reservation_cancelled`, `accommodation_reservation_checked_in`, `accommodation_reservation_checked_out`, `accommodation_reservation_no_show`, `accommodation_payment_received` et `accommodation_payment_completed`. Ils fournissent encore des liens historiques. NAV-CORE doit devenir l'unique résolution effective au travers de destinations canoniques réservation/liste.

## Cartographie Web — référence fonctionnelle

- `PublicAccommodationBookingForm` : dates, adultes, enfants, disponibilité/devis serveur, demandes spéciales, authentification puis création `pending`.
- `AccommodationReservationsPanel` : liste, détail, statuts et finance ; ses actions de confirmation/check-in/check-out restent des opérations propriétaire/staff.
- `AccommodationRefundPanel` : synthèse paiements/remboursements et demande voyageur autorisée par le backend.
- Centre documentaire DOC-EVO : projections de factures Accommodation, document financier conservé comme source de vérité.
- Le Web n'effectue aucun calcul de prix faisant autorité ; le devis affiché provient de l'API de disponibilité.

## Cartographie Mobile

### Existant réutilisable

- Recherche et détail d'annonce Accommodation déjà fonctionnels.
- `DetailAnnonceScreen` connaît le profil Accommodation et son `accommodationId`.
- Écrans Hôtel natifs fournissant les motifs UI liste/détail/réservation.
- Composants `Screen`, `Button`, `Input`, thème, cache mémoire et couche Axios authentifiée.
- FileSystem/Sharing déjà utilisés par GL-MOBILE pour le téléchargement natif.
- NAV-CORE, linking et gestion générique des notifications déjà installés.

### Manques

- Aucun service Mobile pour les réservations Accommodation.
- Aucun espace « Mes hébergements » voyageur.
- Aucun détail séjour avec paiements, remboursements, documents et historique.
- Aucun formulaire de réservation depuis l'annonce.
- Aucun cache de lecture/offline pour ce domaine.
- Aucune destination NAV-CORE Accommodation réservation/détail/réserver.
- Aucun routage canonique des notifications ACC-1.

## Décisions d'architecture

1. Réutiliser strictement les endpoints ACC-1/FC-1/DOC-EVO existants ; aucun nouvel endpoint.
2. Créer un service Mobile mince : appels, cache lecture à durée courte et détection réseau ; aucune formule métier.
3. Créer trois écrans natifs ciblés : liste, détail, réservation.
4. Ajouter le CTA de réservation au détail existant, avec `accommodationId` reçu du DTO public.
5. Étendre l'autorisation des endpoints DOC-EVO existants aux participants Accommodation, sans exposer les métadonnées privées de paiement.
6. Déclarer toutes les destinations dans NAV-CORE et résoudre menus, CTA, notifications et deep links depuis ce registre.
7. Hors ligne : cache lecture seule ; aucune création, annulation ou demande de remboursement différée.
8. Conserver le projet sur son Expo SDK actuel ; aucune montée de version dans ce sprint.

## Non-objectifs

- Aucune logique propriétaire supplémentaire : la gestion existante reste inchangée.
- Aucun paiement initié ou confirmé par le voyageur, car ACC-1 réserve ces opérations au staff comptable.
- Aucune nouvelle règle d'annulation/remboursement, migration, collection ou duplication de document.
