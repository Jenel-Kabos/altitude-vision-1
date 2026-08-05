# Sprint ACC-MOBILE-1 — Rapport final

## Résultat

Le parcours Mobile des hébergements indépendants couvre désormais la consultation des réservations, leur détail, la vérification de disponibilité, la création, le suivi financier, les remboursements, les documents, l'annulation, les notifications et les deep links. Le serveur reste l'unique autorité pour les disponibilités, les montants, la capacité, les transitions, les paiements et les remboursements.

## Audit initial et cartographie

L'audit préalable complet est conservé dans `server/docs/ACC_MOBILE_1_AUDIT.md`. Aucune modification fonctionnelle n'a été effectuée avant sa rédaction.

### Backend existant réutilisé

- `POST /api/accommodation-reservations` : création et validation métier ACC-1.
- `GET /api/accommodation-reservations` et `GET /:id` : listes et détail selon le rôle.
- `POST /:id/cancel` : annulation selon les transitions serveur.
- `GET /api/accommodations/:id/availability` : disponibilité et devis serveur.
- `GET /:id/financial-summary` : facture, paiements et solde.
- `GET /:id/refundable-summary` et `POST /:id/refunds` : synthèse et demande de remboursement.
- Endpoints DOC-EVO existants `/api/financial/documents/:id`, `/pdf/status` et `/pdf/download`.
- Services certifiés `accommodationReservationService`, `accommodationBillingService`, `accommodationRefundService`, `notificationService` et dossier financier.

### Référence Web

- `PublicAccommodationBookingForm` pour les dates, voyageurs, disponibilité et confirmation.
- `AccommodationReservationsPanel` pour les statuts et l'historique.
- `AccommodationRefundPanel` pour la consultation et la demande de remboursement.
- Les écrans Paiement, Documents et Notifications ont fourni les conventions d'affichage et de sécurité.
- Aucun fichier Web fonctionnel n'a dû être modifié.

### Mobile avant sprint

- Liste et détail d'annonce Accommodation déjà présents.
- Composants UI, navigation par stacks, cache de lecture, FileSystem et Sharing réutilisables.
- NAV-CORE et le linking partagé déjà amorcés.
- Manquaient : espace des réservations, réservation, détail métier, financier, remboursements, documents et destinations NAV correspondantes.

## Décisions d'architecture

- Aucun endpoint et aucune règle métier n'ont été recréés.
- Le service Mobile ne calcule ni tarif, ni total, ni remboursement : il affiche exclusivement les réponses serveur.
- Les lectures disposent d'un cache mémoire court avec repli hors connexion. Toutes les mutations sont refusées hors ligne et ne sont jamais mises en file d'attente.
- Les trois destinations Accommodation sont enregistrées dans le registre NAV-CORE partagé ; écrans, notifications et deep links les résolvent via ce registre.
- Les liens explicitement fournis par un domaine existant gardent leur priorité afin de préserver la compatibilité NAV des autres modules ; les notifications Accommodation sans lien local utilisent la destination canonique NAV-CORE.
- Les endpoints DOC-EVO existants acceptent désormais les documents financiers Accommodation après contrôle strict du participant ; la génération reste réservée aux rôles serveur déjà autorisés.
- Les données propriétaire exposées au voyageur sont limitées aux champs déjà sûrs (`nom`, `prenom`, `email`, `telephone`).

## Éléments réutilisés et nouveaux composants

### Réutilisés

- Client API authentifié, FileSystem, Sharing et primitives UI Mobile.
- Services Backend ACC-1/FC-1, documents financiers DOC-EVO et registre NAV-CORE.
- Conventions Web de statut, de devis, de paiement et de remboursement.
- Stack Profil, détail d'annonce, centre de notifications et mécanismes de refresh/pagination.

### Nouveaux

- `MyAccommodationReservationsScreen` : attente, confirmées, en cours, terminées et annulées ; pagination, filtres, skeleton, erreur, pull-to-refresh et grille tablette.
- `AccommodationBookingScreen` : dates, voyageurs, demandes spéciales, devis serveur et confirmation.
- `AccommodationReservationDetailScreen` : séjour, propriétaire, voyageurs, statut, historique, paiements, documents, remboursements et annulation.
- `accommodationReservationService` : façade API, cache de lecture, blocage des écritures offline et téléchargement PDF authentifié.

## Workflows connectés

1. L'annonce ouvre `ACCOMMODATION_BOOKING` via NAV-CORE.
2. Le voyageur saisit dates et voyageurs ; le serveur retourne disponibilité et devis.
3. La confirmation appelle l'API ACC-1 avec la source `mobile`.
4. Le profil ouvre `ACCOMMODATION_RESERVATIONS`, filtrable et paginé.
5. Une réservation ou notification ouvre `ACCOMMODATION_RESERVATION_DETAILS`.
6. Le détail agrège uniquement les synthèses serveur : réservation, financier, document et remboursement.
7. Annulation et demande de remboursement sont soumises au serveur et impossibles hors connexion.

## Impacts Backend, Web et Mobile

- Backend : enrichissement sûr du propriétaire dans les lectures ; accès RBAC aux documents financiers Accommodation ; types et destinations de notifications Accommodation enregistrés.
- Web : aucune modification fonctionnelle. Les routes NAV partagées pointent vers l'espace Web existant `/mes-hebergements`.
- Mobile : trois écrans, un service, entrées Profil/détail annonce, stack et linking NAV ajoutés.

## Sécurité et RBAC

- Toutes les APIs privées conservent l'authentification Bearer existante.
- Un document financier Accommodation n'est lisible que par le voyageur, le propriétaire du logement ou les rôles staff déjà autorisés.
- La relation `subjectType`, `subjectId` et `financialDocument` est vérifiée avant exposition du document/PDF.
- Les téléchargements PDF utilisent l'endpoint authentifié ; aucune URL privée n'est persistée ou codée en dur.
- Aucun paiement n'est initié ni calculé sur Mobile : les écritures financières demeurent sous l'autorité serveur.

## Navigation, notifications et documents

- NAV-CORE contient `ACCOMMODATION_RESERVATIONS`, `ACCOMMODATION_RESERVATION_DETAILS` et `ACCOMMODATION_BOOKING` avec routes Web, écrans Mobile et patterns de liens.
- Tous les événements `accommodation_*` utilisent la résolution canonique de `navigationService`; aucun mapping Accommodation local n'a été ajouté au Mobile.
- Les factures existantes sont prévisualisées à partir de leurs métadonnées et lignes DOC-EVO.
- Le PDF officiel est téléchargeable et partageable lorsqu'un artefact serveur existe. En son absence, l'interface l'indique sans tenter de le générer côté Mobile.
- Les reçus sont représentés par l'historique des paiements confirmé par le serveur.

## Accessibilité, états réseau et responsive

- Libellés accessibles sur les actions principales et états textuels explicites.
- Skeletons, loaders, erreurs récupérables, états vides et pull-to-refresh homogènes.
- Pagination serveur et disposition multi-colonnes sur tablette.
- Hors connexion : consultation du cache disponible, bannière explicite, aucune écriture.

## Tests réellement exécutés

Tous les résultats ci-dessous proviennent d'exécutions fraîches pendant ce sprint.

| Contrôle | Résultat |
| --- | --- |
| Backend Unit (`npm run test:unit -- --runInBand`) | 104 suites, 1 211 tests passés |
| Backend Mongo/Replica (`npm run test:mongo`) | 49 suites, 401 tests passés |
| Mobile Jest (`npm run validate`) | 23 suites, 224 tests passés |
| Web Vitest | 75 fichiers, 503 tests passés |
| Playwright (`npm run test:e2e`) | 34 tests passés, desktop et mobile Chromium, 9,3 min |
| Expo Doctor | 18 contrôles sur 18 passés |
| Export Android | réussi, 1 964 modules, bundle HBC 6,42 Mo |
| TypeScript Mobile | passé |
| ESLint serveur | 0 erreur ; 109 avertissements historiques |
| ESLint client | 0 erreur ; 267 avertissements historiques |
| ESLint mobile | 0 erreur ; avertissements historiques uniquement |
| Build Next.js | réussi ; 134 pages générées |
| Tests NAV/notifications ciblés après correction | Backend 17/17, Mobile 9/9 |
| `git diff --check` | passé |

Une première exécution Mongo a révélé une priorité de lien NAV incompatible avec une notification Property existante. La priorité a été corrigée puis la suite complète relancée avec succès. Des exécutions globales préliminaires Unit/Vitest ont aussi rencontré des tests historiques intermittents ; les relances finales complètes et sérialisées sont celles reportées comme résultats de certification.

## Risques résiduels et dettes restantes

- Le cache offline est en mémoire et ne survit pas au redémarrage de l'application ; il respecte toutefois strictement la lecture seule demandée.
- Un PDF de facture n'est disponible que si l'artefact DOC-EVO a déjà été généré côté serveur. Le Mobile ne contourne pas le RBAC de génération.
- Les paiements Accommodation restent enregistrés par les workflows staff existants : aucun prestataire de paiement voyageur autonome n'existe dans les APIs certifiées et aucun endpoint n'a été inventé.
- Les avertissements ESLint et les données Browserslist obsolètes sont préexistants et non bloquants.
- Le worktree contenait déjà des modifications non commitées NAV-CORE, GL-MOBILE et MOB-GAP ; elles ont été conservées et ne sont pas attribuées à ACC-MOBILE-1.

## Fichiers créés par ACC-MOBILE-1

- `server/docs/ACC_MOBILE_1_AUDIT.md`
- `server/docs/ACC_MOBILE_1_REPORT.md`
- `altimmo-app/src/services/accommodationReservationService.js`
- `altimmo-app/src/services/__tests__/accommodationReservationService.test.js`
- `altimmo-app/src/screens/Accommodation/MyAccommodationReservationsScreen.jsx`
- `altimmo-app/src/screens/Accommodation/AccommodationBookingScreen.jsx`
- `altimmo-app/src/screens/Accommodation/AccommodationReservationDetailScreen.jsx`

## Fichiers modifiés par ACC-MOBILE-1

- `server/controllers/accommodationReservationController.js`
- `server/controllers/financialController.js`
- `server/models/Notification.js`
- `server/services/navigationService.js`
- `server/services/notificationService.js`
- `shared/navigation/registry.json`
- `server/__tests__/navigationRegistry.test.js`
- `server/__tests__/financialAccommodationDocumentsListing.mongo.integration.test.js`
- `altimmo-app/src/navigation/stacks/ProfilStack.jsx`
- `altimmo-app/src/navigation/navigationSdk.js`
- `altimmo-app/src/navigation/__tests__/navigationSdk.test.js`
- `altimmo-app/src/screens/Profil/ProfilScreen.jsx`
- `altimmo-app/src/screens/Annonces/DetailAnnonceScreen.jsx`

## Confirmations

- Aucun commit effectué.
- Aucun push effectué.
- Aucune migration destructive effectuée.
- Aucune suppression de données effectuée.
- Aucun endpoint métier ajouté.
- Aucune règle ACC-1, FC-1, NAV-CORE, DOC-EVO ou GL-MOBILE réimplémentée.
