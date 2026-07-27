# Certification finale Sprint C/D.1.2

Date : 27 juillet 2026. Branche : `fix/admin-accommodation-form`. Aucun commit, aucun push.

## Méthode et audit initial

Notation officielle : conforme = 1, partiel = 0,5, absent = 0. Une ligne n'est conforme que si l'implémentation, le workflow, les autorisations, la persistance et une preuve adaptée existent. L'audit initial C/D.1.2 a trouvé C29 absent et C36/D31 partiels. D29, d'abord soupçonné partiel, était déjà conforme : les notifications d'affectation et de changement sont envoyées après les appels transactionnels dans `roomAssignmentController` et dédupliquées par `HotelReservationNotification`.

Scores recalculés après C/D.1.1 : Sprint C 34,5/36 = 95,83 % ; Sprint D 30,5/31 = 98,39 %.

## Corrections C/D.1.2

- C29 : `RatePlan.seasonalPeriods` porte dates, montant et priorité. Un chevauchement n'est accepté que si la priorité le rend non ambigu. `computeReservationPricing` résout chaque nuit et persiste `rateSnapshot.nightlyRates`. L'API et l'écran Web de gestion des tarifs permettent de configurer plusieurs périodes.
- C36/D31 : `HotelOperationsScreen` charge les hôtels accessibles et les chambres disponibles par libellé, numéro et étage ; aucun identifiant hôtel/chambre n'est saisi.
- Aucun second moteur tarifaire et aucune duplication de notification n'ont été introduits.

## Matrice finale Sprint C

| ID | Exigence | Avant audit | Après C/D.1 | Après C/D.1.1 | État final | Preuve code | Preuve test/recette | Points |
|---|---|---|---|---|---|---|---|---:|
| C01 | Création de réservation | C | C | C | Conforme | `hotelReservationService.createReservation`; POST `/hotels/:hotelId/reservations` | `hotelReservationService.test.js`, routes | 1 |
| C02 | Modification de réservation | C | C | C | Conforme | `updateReservation`; PATCH `/hotel-reservations/:id` | service + pages Web/Mobile | 1 |
| C03 | Annulation | C | C | C | Conforme | `transitionStatus(cancelled)` | routes + écrans client | 1 |
| C04 | Expiration automatique | C | C | C | Conforme | `hotelReservationExpiryService` | `hotelReservationExpiryService.test.js` | 1 |
| C05 | Validation métier | C | C | C | Conforme | modèles, contrôleur, service | services/routes | 1 |
| C06 | Conflits de statut | C | C | C | Conforme | `ALLOWED_TRANSITIONS` | transitions 409 | 1 |
| C07 | Double transition idempotente | C | C | C | Conforme | relecture conditionnelle d'état | tests doubles opérations | 1 |
| C08 | Réservations simultanées | P | C | C | Conforme | réservation atomique | tests concurrence + Replica Set | 1 |
| C09 | Historique | C | C | C | Conforme | `statusHistory` | modèle/services/E2E | 1 |
| C10 | Journalisation | P | C | C | Conforme | ActionLog + logger structuré | routes/opérations | 1 |
| C11 | Idempotence de création HTTP | A | C | C | Conforme | clé, hash, index unique partiel | 20 retries Mongo + conflit payload | 1 |
| C12 | Disponibilité temps réel | C | C | C | Conforme | `getAvailability` | service/routes | 1 |
| C13 | Réservation atomique du stock | P | C | C | Conforme | `reserveInventory` conditionnel | dernier stock/concurrence | 1 |
| C14 | Libération du stock | C | C | C | Conforme | `releaseInventory` | annulation/expiration/départ | 1 |
| C15 | Recherche par période | C | C | C | Conforme | availability/calendar bornés | API + calendrier | 1 |
| C16 | Disponibilité restante | C | C | C | Conforme | agrégat `availableUnits` | blocked/physical tests | 1 |
| C17 | Inventaire par catégorie | C | C | C | Conforme | `RoomInventory.roomCategory` | modèle/service | 1 |
| C18 | Réservation multichambre | P | C | C | Conforme | `roomsCount` | E2E Mongo multichambre | 1 |
| C19 | Reconstruction opérationnelle | P | C | C | Conforme | `rebuildInventory` + lock Mongo | `inventoryOperationLock.mongo.integration.test.js` | 1 |
| C20 | Couplage check-in / inventaire | P | C | C | Conforme | `performCheckIn` | services + E2E | 1 |
| C21 | Couplage check-out / inventaire | P | C | C | Conforme | `performCheckOut` | services + E2E | 1 |
| C22 | Agrégat hôtel complet | P | C | C | Conforme | `hotelInventoryController.calendar` | contrôleur/service | 1 |
| C23 | Calendrier d’inventaire | P | C | C | Conforme | `HotelInventoryCalendarPage` | 4 tests Web dédiés | 1 |
| C24 | Blocage / stop-sell exploitable | P | C | C | Conforme | blockedUnits/stopSell/isClosed | service, Web, Mobile | 1 |
| C25 | Tarif provenant d’un RatePlan | C | C | C | Conforme | `computeReservationPricing` | service | 1 |
| C26 | Snapshot tarifaire | C | C | C | Conforme | `rateSnapshot` | unitaires + Mongo | 1 |
| C27 | Tarif sélectionné cohérent | C | C | C | Conforme | id + catégorie + actif | rejet tarif incohérent | 1 |
| C28 | Calcul du séjour | C | C | C | Conforme | somme nuits × roomsCount | unitaires | 1 |
| C29 | Tarification saisonnière datée | P | P | A | Conforme | `seasonalPeriods`, résolution/priorité/snapshot | modèle, service, Replica Set traversant deux périodes | 1 |
| C30 | Notification de création au gestionnaire | C | C | C | Conforme | notification post-création | service | 1 |
| C31 | Notification de confirmation au client | C | C | C | Conforme | `notifyStatusChange` | service/anti-doublon | 1 |
| C32 | Notification d’annulation au client | C | C | C | Conforme | `notifyStatusChange` | service/routes | 1 |
| C33 | Notification de modification | P | C | C | Conforme | événement `modified:*` | service | 1 |
| C34 | API Web | C | C | C | Conforme | routes publiques/protégées | tests routes/sécurité | 1 |
| C35 | Parcours Web | P | C | C | Conforme | widget, listes, détail, calendrier | 57 suites Web ; recette matérielle indisponible | 1 |
| C36 | Parcours Mobile | P | P | P | Conforme | booking + détail + opérations avec sélecteurs | 20 suites Mobile ; test opérations C/D.1.2 | 1 |

Calcul : 36 conformes, 0 partielle, 0 absente. `(36 × 1) / 36 × 100 = 100,00 %`.

## Matrice finale Sprint D

| ID | Exigence | Avant audit | Après C/D.1 | Après C/D.1.1 | État final | Preuve code | Preuve test/recette | Points |
|---|---|---|---|---|---|---|---|---:|
| D01 | RoomCategory | C | C | C | Conforme | `RoomCategory` | modèle/publication | 1 |
| D02 | Room | C | C | C | Conforme | `Room` | modèle/routes | 1 |
| D03 | Statut available | C | C | C | Conforme | transitions Room | modèles/services | 1 |
| D04 | Statut reserved | C | C | C | Conforme | affectation | assignment tests | 1 |
| D05 | Statut occupied | C | C | C | Conforme | check-in | check-in/E2E | 1 |
| D06 | Statut cleaning | C | C | C | Conforme | change/check-out | services/E2E | 1 |
| D07 | Statut inspection | P | C | C | Conforme | housekeeping/inspection | services/E2E | 1 |
| D08 | Statut out_of_service | P | C | C | Conforme | maintenance | services/E2E | 1 |
| D09 | Statut maintenance explicite ou représentation métier équivalente documentée | P | C | C | Conforme | Room OOS + ticket actif/raison/période/bloc | `HOTEL_OPERATIONS_V2.md`, maintenance/E2E | 1 |
| D10 | Affectation manuelle | C | C | C | Conforme | `assignRoom` | service/routes/UI | 1 |
| D11 | Affectation automatique réelle | P | C | C | Conforme | `autoAssignRooms` | service + Mongo | 1 |
| D12 | Historique d’affectation | C | C | C | Conforme | `RoomAssignment.releasedAt` | modèle/E2E | 1 |
| D13 | Réaffectation | P | C | C | Conforme | marker + `changeRoom` | maintenance/E2E | 1 |
| D14 | Changement de chambre | P | C | C | Conforme | transaction `changeRoom` | avant/après check-in | 1 |
| D15 | Affectation multichambre | P | C | C | Conforme | limite `roomsCount` | service/Mongo | 1 |
| D16 | Cohérence affectation / statut | C | C | C | Conforme | filtres atomiques/index | concurrence | 1 |
| D17 | Validation du check-in | C | C | C | Conforme | `performCheckIn` | service/routes | 1 |
| D18 | Passage de Room à occupied | C | C | C | Conforme | check-in transactionnel | multichambre | 1 |
| D19 | Atomicité du check-in | P | C | C | Conforme | `runFinancialOperation` | rollback/concurrence | 1 |
| D20 | Mise à jour de la réservation | C | C | C | Conforme | checked_in + historique | service | 1 |
| D21 | Libération au check-out | C | C | C | Conforme | `releaseAllRooms` | service/E2E | 1 |
| D22 | Transition réservation au départ | C | C | C | Conforme | checked_out | service | 1 |
| D23 | Journalisation du départ | P | C | C | Conforme | actualCheckOutAt/history/logs | checkout tests | 1 |
| D24 | Synchronisation stock au départ anticipé | P | C | C | Conforme | libération nuits futures | multichambre/E2E | 1 |
| D25 | Workflow opérationnel complet | P | C | C | Conforme | chaîne services C/D | scénario Replica Set | 1 |
| D26 | Transitions autorisées | C | C | C | Conforme | constantes centralisées | services | 1 |
| D27 | Transitions interdites | C | C | C | Conforme | gardes 409 | tests négatifs | 1 |
| D28 | API protégée | C | C | C | Conforme | auth + capabilities/scopes | routes + tests inter-hôtels | 1 |
| D29 | Notifications complètes | P | C | C | Conforme | réservation, affectation, changement, séjour, maintenance | services/contrôleurs + anti-doublon Mongo | 1 |
| D30 | Interface Web | P | C | C | Conforme | calendrier/panneaux/housekeeping/maintenance | tests Web ; matériel indisponible | 1 |
| D31 | Interface Mobile | P | P | P | Conforme | `HotelOperationsScreen`, inventaire et sélecteurs | test Mobile C/D.1.2 | 1 |

Calcul : 31 conformes, 0 partielle, 0 absente. `(31 × 1) / 31 × 100 = 100,00 %`.

## Tests et scénario réel

- Backend unitaire : 87 suites, 1 081 tests.
- MongoDB Replica Set réel : 19 suites, 190 tests. Index synchronisés. Le scénario C/D couvre idempotence concurrente, multichambre, changements avant/après arrivée, check-in/out, ménage, inspection échouée/réussie, maintenance, départ anticipé et cohérence finale. Le test C29 persiste `[50 000, 85 000, 50 000]` sur un séjour traversant une période prioritaire.
- Web : 57 suites, 393 tests.
- Mobile : 20 suites, 211 tests.
- Aucun doublon d'affectation, tâche ouverte, réservation idempotente ou notification ; aucun stock négatif ni chambre OOS vendable dans les assertions finales.

## Recettes et accessibilité

| Cas | Environnement | Résultat | Preuve | Limite |
|---|---|---|---|---|
| Web desktop/tablette/mobile, clair/sombre, zoom/clavier | navigateur intégré | Non exécutable | surface `iab` indisponible lors du bootstrap officiel | aucun rendu navigateur réel revendiqué |
| Android | ADB | Non exécutable | `adb devices -l` : liste vide | aucun appareil/émulateur ; export ≠ recette |
| iOS | Xcode | Non exécutable | `simctl` absent | aucun simulateur/appareil |
| TalkBack/VoiceOver | matériel | Non exécutable | dépend des supports ci-dessus | non validé matériellement |

Les tests automatiques vérifient labels, rôles, états accessibles, navigation clavier du calendrier, thèmes et contrôles non exclusivement coloriels. Ils ne valident pas le contraste/rendu, le zoom réel, TalkBack ni VoiceOver.

## Sécurité, observabilité et D09

Les routes vérifient invité/client, propriétaire, GestionnaireImmobilier, collaborateur rattaché et Admin, avec isolation inter-hôtels/inter-clients. Les opérations inventaire, reconstruction, stop-sell, affectation, check-in/out, inspection et maintenance passent par les capabilities centrales. Les logs structurés contiennent identifiants métier/codes, jamais token, mot de passe ou paiement. D09 utilise la représentation B : Room `out_of_service`, ticket avec description/catégorie, timestamps de période, impact `physicalBlockedUnits`, résolution puis inspection contrôlée.

## Gates

Résultats finaux : `health` 28/28, `verify` 4/4, `ci` 12/12 et `release-check` 12/12. Les 87 suites Backend (1 081 tests), 19 suites MongoDB (190 tests), 57 suites Web (393 tests) et 20 suites Mobile (211 tests) passent. Le lint ne contient aucune erreur, le typecheck Mobile passe, le build Next.js génère 128 pages, Expo Doctor passe 18/18, l'export Android réussit et `git diff --check` est propre. Les avertissements lint historiques restent non bloquants ; aucun nouvel avertissement propre aux fichiers C/D.1.2 n'est apparu.

Le script demandé `export:android` n'existe pas dans `altimmo-app/package.json`; la gate canonique du dépôt est `npm run export` (`expo export --platform android`). De même, Expo Doctor a été exécuté depuis le répertoire Mobile avec `npx expo-doctor`, équivalent fonctionnel de la commande préfixée demandée.

## Décision F2.2

La conformité fonctionnelle et technique atteint 100 % sur le référentiel officiel. Les validations matérielles additionnelles restent explicitement non exécutées et ne masquent aucun écart fonctionnel identifié. Aucun travail F2.2 n'a été commencé.
