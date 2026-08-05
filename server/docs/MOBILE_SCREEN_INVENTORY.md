# MOB-GAP-1 — Inventaire certifié des écrans Mobile natifs

## Méthode

Inventaire fondé sur les imports et enregistrements réels de `AppNavigator`, `TabNavigator`, `AuthNavigator`, `ProfilStack`, `PublicationStack` et `MessagerieStack`, puis vérification des appels API, états de chargement/erreur et tests. Un fichier seul n'est jamais compté comme écran disponible.

Le script statique recense 37 fichiers d'écran, 46 noms de routes enregistrés (certains composants sont enregistrés dans plusieurs stacks), 82 appels API natifs et deux rendus hors enregistrement direct :

- `OnboardingScreen` est atteint avant `NavigationContainer` ;
- `HotelEstablishmentScreen` est rendu par `AddAccommodationScreen` pour le parcours hôtel.

Il n'existe donc aucun fichier d'écran mort confirmé dans `src/screens` à la date de l'audit.

## Existants et fonctionnellement substantiels

| Audience | Route/écran | Preuve de navigation | Capacités vérifiées |
|---|---|---|---|
| Public | Onboarding | rendu direct par `AppNavigator` | introduction et choix connexion |
| Public | Login, Register, ForgotPassword, ResetPassword | `AuthNavigator` | authentification, inscription, récupération |
| Tous connectés | CompleterProfil | branche `needsProfileCompletion` | complétion obligatoire |
| Public/client | ListeAnnonces, DetailAnnonce, Carte | tab `Annonces` et `Carte` | recherche, filtres, détail, recommandations, avis, favoris, partage, signalement |
| Client | SubmitRealEstateApplication | `ProfilStack`, depuis détail | offre/candidature et pièces |
| Client | RealEstateApplications, RealEstateApplicationDetail | `ProfilStack`, menu profil | liste, suivi, retrait, réservation |
| Client/owner | Visites | tab dédiée | agenda, annulation, actions propriétaire partielles |
| Tous connectés | Conversations, Chat, Chatbot | tab `Messages` | liste, temps réel, texte, pièces jointes |
| Tous connectés | Notifications | `AnnoncesStack` | liste, lu/non lu, suppression, résolution partielle de destination |
| Owner autorisé | ChoixTypeAnnonce, AddSaleProperty, AddRentalProperty | tab conditionnelle `Publier` | publication vente/location |
| Owner autorisé | AddAccommodation | `PublicationStack` | publication hébergement indépendant ou établissement hôtelier |
| Owner | MesAnnonces, PublierBien | `ProfilStack` | inventaire personnel, modification, disponibilité, requêtes locatives limitées |
| Client | Favoris | `ProfilStack` | favoris immobiliers |
| Client | Transactions, Paiement, VirementScreen | `ProfilStack` | suivi transaction, initiation Mobile Money, justificatif de virement |
| Client | HotelBooking | `ProfilStack` depuis réservations | recherche, disponibilité, catégorie, tarif, création idempotente |
| Client | MyHotelReservations, HotelReservationDetail | `ProfilStack` | liste, détail, annulation |
| Staff hôtel autorisé | HotelOperations | `ProfilStack`, menu conditionné par rôle/capacité | chambres, affectation, check-in/out, inventaire et stop-sell |
| Tous connectés | ProfilHome, EditProfile, ChangePassword | `ProfilStack` | profil et sécurité |
| Tous connectés | PolitiqueConfidentialite, CacheManagement | `ProfilStack` | information et cache local |

## Existants mais partiels

| Écran | Limite constatée | Classification |
|---|---|---|
| `VisitesScreen` | pas de parcours certifié complet de paiement de visite ; reprogrammation/incident/no-show non entièrement symétriques au Web | workflow incomplet, P0/P1 |
| `MesAnnoncesScreen` | résumé de gestion locative et demandes simples seulement ; aucun revenu détaillé, document, carnet d'entretien ou dossier complet | partiel propriétaire, P1 |
| `TransactionsScreen` / `PaiementScreen` | paiement initié/vérifié mais couverture UI/tests du cycle d'échec, facture et remboursement incomplète | partiel, P0 |
| `HotelBookingScreen` | crée une réservation mais indique explicitement qu'aucun paiement n'est prélevé | workflow paiement absent, P0 |
| `HotelOperationsScreen` | opérations chambre et inventaire présentes ; housekeeping, inspection, maintenance et finance absents | partiel staff terrain, P0/P1 |
| `NotificationsScreen` | écran présent, mais plusieurs types métier n'ont aucune cible native | navigation partielle, P0 |
| `DetailAnnonceScreen` | immobilier riche ; hébergement indépendant visible mais sans réservation native | partiel hébergement, P0 |
| `RealEstateApplicationDetailScreen` | suivi et passage transaction présents ; comparaison/acceptation/rejet restent Web staff | choix Web-only légitime côté staff |

## Écrans manquants

### P0

- Portail locataire : tableau de bord, bail, échéancier, paiements, quittances, maintenance, documents.
- Réservation d'hébergement indépendant : disponibilité, création, mes réservations, annulation, paiement et remboursement.
- Paiement hôtel, facture et remboursement client.
- Housekeeping, inspection et maintenance hôtelière terrain.
- Cibles natives pour notifications de candidatures, réservations immobilières et gestion locative.

### P1

- Préavis, inspection de sortie et caution du locataire.
- Cockpit patrimoine propriétaire : cycle de vie, revenus/dépenses, alertes, entretien et valorisation.
- Documents personnels et financiers : liste, aperçu, téléchargement et partage.
- Calendrier/blocages/analytics des hébergements propriétaire.
- Deep links pour réservations, paiements, documents, contrats et maintenance.

### P2/P3

- Espaces client Altcom et Mila Events.
- Préférences utilisateur avancées.
- Fonctions de confort et visualisations denses.

## Écrans à maintenir Web-only

- modération exhaustive des annonces ;
- administration utilisateurs/rôles/configuration ;
- gestion locative staff complète et création contractuelle complexe ;
- centre documentaire administratif global ;
- finance avancée, rapprochement, émission/annulation comptable et remboursements staff ;
- configuration hôtel, catégories, plans tarifaires et personnel ;
- comparaison/validation staff des candidatures ;
- administration de contenu Altcom/Mila Events.

Ces fonctions ne correspondent ni à un usage terrain urgent, ni à une consultation personnelle. Leur duplication augmenterait fortement le risque RBAC, financier et documentaire.
