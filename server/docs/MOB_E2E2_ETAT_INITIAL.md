# MOB-E2E-2 — État initial

Date : 2026-08-16. Branche `main`, HEAD `ab5ae586fab50ddce02e65ea081330d2769c6503` avant tout travail de ce sprint (inchangé pendant tout le sprint, aucun commit).

## 1. Contexte et objectif du sprint

MOB-E2E-2 fait suite à MOB-E2E, où 8 des 10 flows Maestro avaient échoué en exécution batch à cause d'un problème de timing non déterministe sur l'overlay natif Expo Dev Client. Ce sprint a deux phases obligatoires : (A) stabiliser l'infrastructure de lancement déterministe, (B) certifier le cycle de vie complet du PMS hôtelier (Réservation → Room Available) sur runtime Android réel.

## 2. État hérité de MOB-E2E (non remis en cause)

- Build Android réel fonctionnel via `expo run:android` avec JDK 17 (JDK 26 par défaut incompatible, connu et évité).
- Auth (login réel), Dark Mode, cross-owner (accès refusé propre) déjà prouvés en exécution directe (non-batch) lors de MOB-E2E.
- Maestro CLI 2.8.0 déjà installé.
- iOS jamais exécuté — `NON CERTIFIÉ`, statut hérité inchangé.

## 3. Problème hérité à résoudre en Phase A

En exécution batch (`maestro test`), 8/10 flows échouaient de façon non déterministe. Cause jamais isolée précisément dans MOB-E2E (attribuée génériquement à un « menu développeur Expo » sans preuve). Le mandat MOB-E2E-2 interdit explicitement cette généralisation et exige un diagnostic précis par composant.

## 4. Environnement machine

Node v20.20.2, npm 10.8.2, `npx expo --version` 57.0.15. `expo` en dépendance : `~57.0.13`, `react-native`: `0.86.2`. JDK utilisé pour les builds : Temurin 17 (JDK 26 par défaut du système reste incompatible, non touché ce sprint). macOS, x86_64.

## 5. Émulateur Android

AVD `Pixel_6` (API 34), device confirmé `sdk_gphone64_x86_64`, Android 14 (`ro.build.version.release=14`). Déjà démarré et en état `sys.boot_completed=1` au début du sprint (hérité de la session précédente, non redémarré inutilement).

## 6. Application mobile installée

`com.altitudevision.altimmo`, déjà installée en debug (build MOB-E2E), non recompilée en début de sprint (aucune modification de code source app ayant nécessité un rebuild avant la phase de diagnostic Dev Client).

## 7. Backend de test hérité

`server/scripts/start-mobile-e2e.js` (créé en MOB-E2E) : réutilise les fixtures `ids`/`seed()` de `start-accommodation-e2e.js`, ajoute un fixture locataire dédié. Ne contient, au début de ce sprint, aucune fixture PMS (réservation hôtelière pré-seedée) — ajoutée ce sprint (§29 du rapport final).

## 8. Fixtures de comptes disponibles au départ

- `owner-e2e@example.test` / `E2eOwner!2026` — rôle `Admin`.
- `client-e2e@example.test` — rôle `Client`.
- `rental-owner-e2e@example.test` / `E2eOwnerRental!2026` — rôle `Proprietaire`, propriétaire réel de `dash4HotelA` (8 chambres physiques réelles, catégorie E2E-1) et `dash4HotelB`.
- `tenant-e2e@example.test` / `E2eTenant!2026` — rôle `Client` + dossier `Locataire`/`Contrat` actif.

Aucune réservation hôtelière (`HotelReservation`) n'existe dans les fixtures au départ de ce sprint.

## 9. Modèle PMS existant (lu, non modifié)

`server/models/HotelReservation.js` : statuts `['pending','confirmed','cancelled','expired','rejected','checked_in','checked_out']`, `ALLOWED_TRANSITIONS` centralisées (`confirmed→checked_in→checked_out`). `server/models/Room.js` : statuts `['available','occupied','reserved','out_of_service','cleaning','inspection']` avec `ROOM_STATUS_TRANSITIONS` strictes (notamment `out_of_service→inspection` uniquement, jamais direct vers `available`).

## 10. Modèle financier existant (lu, non modifié)

`GET /api/hotel-reservations/:id/checkout-financial-readiness` retourne `{allowed, status, blockers[], financialSnapshot}`. Blocage réel observé dès le check-in : `FINANCIAL_DOCUMENT_NOT_ISSUED`, `FINANCIAL_BALANCE_REMAINING`, `FINANCIAL_PAYMENT_NOT_SETTLED`, `FINANCIAL_LINES_NOT_FINALIZED`. Résolution nécessite un cycle complet (`invoice-draft` implicite au check-in → `finalize-lines` → `issue` → `POST /api/financial/hotel/payments` → `confirm` → `allocations`), routes Admin-only (`server/routes/financialRoutes.js`, montées sous `/api/financial`). Aucune UI mobile pour ce cycle (finance reste Web/Admin-only par design, confirmé en lisant l'écran `HotelOperationsScreen.jsx`).

## 11. Écrans hôteliers mobiles existants (lus, non modifiés au départ)

`HotelOperationsScreen.jsx` (réservations, affectation de chambre, check-in/out), `HotelCockpitScreen.jsx` (KPIs), `HotelHousekeepingScreen.jsx` (tâches de ménage), `HotelMaintenanceScreen.jsx` (tickets de maintenance). Tous déjà présents avant ce sprint (sprints antérieurs D/E), jamais exécutés sur device réel avant ce sprint.

## 12. Housekeeping/Maintenance backend existant

`server/services/housekeepingService.js` : `createTask`/`assign`/`start`/`complete`/`cancel`, chacun émettant un événement temps réel via `emitHotelEvent(hotelId, {...})` (`server/socket.js`). `server/services/inspectionService.js` : `createInspection`/`approveInspection`/`rejectInspection`, avec règle stricte `out_of_service→inspection→available` (retour direct interdit). `server/services/maintenanceService.js`/`maintenanceController.js` : cycle complet `open→assigned→in_progress→resolved→closed`, avec re-inspection optionnelle si le ticket provient d'une inspection échouée.

## 13. Scripts Maestro existants au départ

`.maestro/01-launch.yaml` et `02-login.yaml` (réécrits en MOB-E2E, mais instables en batch), `03` à `09` (créés initialement, jamais stabilisés), `smoke.yaml`, `README.md`. Aucun script de lancement déterministe (`mob-e2e-prelaunch.sh`) n'existe au départ de ce sprint — c'est l'objet de la Phase A.

## 14. Modèle de rôles réel (rappel, non modifiable)

`User.role` ∈ `['User','Client','Proprietaire','Collaborateur','Admin','Prestataire']`. Seul `Admin` peut exécuter les actions financières hôtelières (`assertCanCreateFinancialPayment`/`assertCanConfirmFinancialPayment`/`assertCanAllocatePayment`, `server/services/authz` ou équivalent lu via les contrôleurs). Le `Proprietaire` (Owner) ne peut pas et ne doit pas obtenir ces droits pour ce sprint — mandat explicite de ne pas élargir ses permissions.

## 15. Suites de tests baseline (avant sprint)

Suite serveur : 116 suites / 1331 tests (référence, à revérifier identique ou supérieure en fin de sprint — confirmée identique, voir rapport final §gates). Suite mobile : 40 suites / 358 tests. Lint serveur/client/mobile : 0 erreur (uniquement des warnings pré-existants). Expo Doctor : 21/21. Export Android : non re-testé en tout début de sprint (dernier état connu : PASS, hérité de MOB-E2E).

## 16. `.env` mobile au départ

Restauré aux valeurs de production à la fin de MOB-E2E (`API_URL`/`EXPO_PUBLIC_API_URL`/`EXPO_PUBLIC_SOCKET_URL` → `https://altitude-vision.onrender.com`, `EXPO_PUBLIC_SENTRY_DSN` renseigné). Re-basculé vers le backend de test local (`10.0.2.2:5057`) au début de ce sprint pour permettre l'exécution — restauration finale documentée dans le rapport (§ gates/environnement).

## 17. Contraintes absolues rappelées (mandat)

Aucun `git add`/`commit`/`push`/déploiement. Aucun service de production réel (Mongo/Cloudinary/email/push/paiements). Aucun build EAS cloud (local uniquement). Modification du code app uniquement pour un bug runtime démontré ou un `testID`/`accessibilityLabel` minimal strictement nécessaire — jamais pour adapter artificiellement l'UI aux tests. Modification backend uniquement pour fixtures/scripts de test ou un correctif réellement démontré — jamais de changement de logique métier pour la commodité E2E.

## 18. Portée explicitement prévue comme secondaire

Au-delà du PMS (obligatoire), le mandat prévoit Messaging, Tenant Portal, Notifications/deep-links, background/cold-start, reconnexion socket, perte réseau — uniquement « si le temps le permet », avec obligation de marquer `NON CONFIRMÉ` tout élément non réellement exécuté. Point de départ : aucun de ces éléments n'a été (re)testé au sein de ce sprint avant la Phase A/B ci-dessus.
