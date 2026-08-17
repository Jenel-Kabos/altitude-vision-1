# POST-E2E-1 — État initial

Date : 2026-08-16 (soirée, suite immédiate de MOB-E2E-2). Branche `main`, HEAD `ab5ae586fab50ddce02e65ea081330d2769c6503`, **inchangé** au démarrage de ce sprint (identique à la clôture de MOB-E2E-2).

## 1. État Git au démarrage

`git status --short` identique à la fin de MOB-E2E-2 : fichiers hérités des sprints UI-MOB-1→4/MOB-E2E/MOB-E2E-2 (modifiés ou non suivis), plus les deux rapports `server/docs/MOB_E2E2_*.md` nouvellement créés. Aucune modification depuis. `git diff --check` : `exit 0`. Aucun commit, HEAD identique.

## 2. État Android/émulateur

`adb devices` : `emulator-5554` (device). AVD `Pixel_6`, API 34, hérité, toujours démarré depuis MOB-E2E-2, non redémarré inutilement.

## 3. Expo / Maestro / JDK

`npx expo --version` : 57.0.15 (`expo` en dépendance `~57.0.13`, `react-native` `0.86.2`), inchangé. Maestro CLI présent à `/Users/apple/.maestro/bin/maestro` (pas sur le `PATH` par défaut du shell non-interactif — nécessite `export PATH="$HOME/.maestro/bin:$PATH"` à chaque nouvelle invocation `Bash`, déjà connu depuis MOB-E2E-2). JDK Temurin 17 utilisé pour le build (JDK 26 par défaut du système reste incompatible, non touché).

## 4. Backend de test

Aucun processus `start-mobile-e2e.js`/`server.js` de test actif au démarrage (arrêté proprement à la fin de MOB-E2E-2, ports `5057`/`8081` libres, vérifié). `.env` mobile confirmé aux valeurs de production au démarrage de ce sprint (vérifié par lecture directe).

## 5. Flows Maestro existants

`altimmo-app/.maestro/` : `01-launch.yaml`/`02-login.yaml` (stabilisés, réutilisables tels quels), `mob-e2e-prelaunch.sh` (mécanisme de lancement déterministe certifié 5/5, à réutiliser sans modification), `_dev_client_launch.yaml` (non utilisé), `03-properties.yaml` à `09-logout.yaml` + `smoke.yaml` (créés en amont de tout run réel, **jamais validés sur device réel** — leurs sélecteurs, notamment `06-messaging.yaml` (`tapOn: "Messages"`) et `08-notification-deeplink.yaml` (`openLink: "altimmo://visites"`), sont **non fiables a priori** et seront vérifiés/corrigés si utilisés, pas supposés corrects).

## 6. Fixtures disponibles (héritées, lues intégralement)

`server/scripts/start-mobile-e2e.js` importe `{ids, seed}` de `start-accommodation-e2e.js` puis ajoute un fixture Tenant Portal et 3 réservations PMS. Comptes existants : `owner-e2e@example.test`/`E2eOwner!2026` (Admin — rôle staff), `client-e2e@example.test`/`E2eClient!2026` (Client), `rental-owner-e2e@example.test`/`E2eOwnerRental!2026` (Proprietaire, manager unique de `dash4HotelA` **et** `dash4HotelB`), `tenant-e2e@example.test`/`E2eTenant!2026` (Client + `Locataire` liée à un `Contrat` actif sur la Villa E2E Brazzaville, `bien: ids.property`). Réservations PMS `reservationA/B/C` (statut `confirmed`, Hôtel A) — état résiduel possible du dernier run MOB-E2E-2 si le backend n'est pas redémarré (à vérifier/re-seeder pour repartir propre).

## 7. Fixtures manquantes nécessaires à ce sprint

Aucun deuxième Proprietaire ni Hôtel C n'existe (nécessaire pour tester un deep-link étranger refusé sur une ressource hôtelière). Aucun deuxième Tenant/Locataire/Contrat (nécessaire pour tester l'isolation Tenant Portal — un locataire A ne doit pas lire les données du locataire B). Prévu : extension additive de `start-mobile-e2e.js` (jamais un second système parallèle, conforme mandat §31).

## 8. Navigation mobile — architecture confirmée

`shared/navigation/registry.json` est le **registre canonique unique**, consommé à la fois par `altimmo-app/app.config.js` (scheme `altimmo://`, universal links `https://altitudevision.agency`) et par `altimmo-app/src/navigation/navigationSdk.js` (`linking` config React Navigation + résolveur `resolveNotificationMobileTarget`). Déclare notamment `HOTEL_COCKPIT`/`HOTEL_OPERATIONS`/`HOUSEKEEPING`/`HOTEL_MAINTENANCE` (deep link `mes-hotels/:hotelId[...]`, rôles `Admin`/`Proprietaire`), `MESSAGES`/`CONVERSATION` (`messages[/:id]`), `TENANT_PORTAL` et ses sous-sections (`espace-locataire[/section]`).

## 9. Notification registry — résolution de navigation

**Une seule chaîne de résolution canonique confirmée**, appelée depuis exactement 2 points d'entrée (tap push, tap in-app) : `resolveNavigation()` dans `altimmo-app/src/services/notificationsService.js`. Ordre : registre partagé (`navigationSdk.resolveNotificationMobileTarget`) → table `TYPE_TO_SCREEN` locale (fallback legacy) → `data.screen` serveur si dans une liste blanche (`safeScreens`). Commentaire explicite dans le code : *« SYNC-2C — source unique »*. Pas de table dupliquée détectée — conforme à l'attendu.

## 10. Socket.IO mobile — état réel du client

`altimmo-app/src/services/socketService.js` : singleton, reconnexion automatique activée (`reconnection:true`, jusqu'à 10 tentatives), refresh du token à chaque tentative de reconnexion. **Le rejoin de room après reconnexion n'est PAS générique dans `socketService.js`** — il est délégué à chaque hook consommateur. Vérifié : `altimmo-app/src/hooks/useHotelRealtime.js` implémente correctement un `socket.on('connect', rejoin)` + rejoin immédiat si déjà connecté (commentaire : *« SYNC-2B... Rejoint automatiquement au (re)connect, mandat §38 »*) — donc le rejoin de room hôtel après reconnexion **est bien implémenté au niveau du hook**, à vérifier empiriquement sur device (ce sprint), pas supposé cassé ni supposé fonctionnel sans preuve runtime.

## 11. Tenant Portal — état réel du code

`TenantPortalScreen.jsx` (mobile) : 6 onglets (`dashboard`, `lease`, `payments`, `documents`, `notice`, `maintenance`). Pas d'onglet « quittances »/« pénalités » séparé : pénalités affichées inline par ligne de paiement, quittances/documents regroupées sous l'onglet Documents. Chaîne de rattachement stricte et non contournable : `resolveLocataireForUser(req.user.id)` (`server/services/tenantLinkService.js`) → `Locataire.findOne({user: userId})` → jamais un `locataireId` client-fourni. Formulaire de demande de maintenance locataire existant et fonctionnel (`renderMaintenance()`), upload photo via stockage privé serveur (jamais Cloudinary direct côté client).

## 12. Messaging — état réel du code et chemin UI réel identifié

Règle de routage confirmée : un utilisateur non-staff ne peut démarrer une conversation qu'avec le staff (`startConversation`, 403 sinon). Chemin UI réel identifié : `DetailAnnonceScreen.jsx` → bouton « Contacter l'agent » (`contacterAgent`, ligne ~494) → `POST /conversations/start` → navigation automatique vers `Messages > Chat`. C'est le scénario minimal réel à utiliser (Client réel → contact réel du staff), pas un scénario inventé. Isolation vérifiée dans le code : `assertConversationAccess()` exige participant ou staff, 403 sinon.

## 13. Inspection Fail — comportement attendu déterminé depuis le code (avant exécution)

`rejectInspectionCore` (`server/services/inspectionService.js`) : chambre `inspection → out_of_service` (garde atomique), **aucun `MaintenanceTicket` créé automatiquement**, `notifyStaff({type:'room_inspection_failed'})` + `emitHotelEvent({eventType:'inspection.failed'})` tous deux fire-and-forget. Aucune tâche `HousekeepingTask` retouchée par ce chemin. Attente à vérifier à l'exécution : chambre finit `out_of_service` (pas `available`, contrairement au chemin Pass).

## 14. Bug ActionLog — cause exacte confirmée avant correction

`server/models/ActionLog.js` : enum `typeAction` utilise la forme accentuée `'CRÉATION'`. `server/controllers/inspectionController.js` (création d'inspection) passe la forme non accentuée `'CREATION'` → échec de validation Mongoose silencieux (non `await`-é, catché dans `actionLogService.logAction`). **Le même bug existe à 13 autres emplacements** (`accommodationController.js`, `hotelController.js`, `hotelReservationController.js`, `maintenanceController.js`, `salePropertyController.js`, `housekeepingController.js`, `locataireController.js`, `rentalPropertyController.js`, `rentalMaintenanceController.js`, `roomController.js`) — même cause racine, même correction (littéral incorrect au niveau du producteur), pas un défaut du schéma `ActionLog`.

## 15. Auth / erreur réseau (SYNC-2A) — état confirmé avant test

`altimmo-app/src/services/api.js` : l'invalidation de session ne se déclenche que sur `401` réel ou sur un code de statut de compte structuré (`ACCOUNT_SUSPENDED`/`ACCOUNT_BANNED`/`ACCOUNT_INACTIVE`) — jamais sur une erreur réseau pure (`error.response === undefined`). Commentaire explicite dans le code confirmant l'intention. À vérifier empiriquement (coupure réseau réelle via `adb shell svc wifi/data disable`).

## 16. Zones déjà certifiées (ne pas refaire sans raison)

PMS nominal 3/3, Cockpit, Maintenance (cycle complet), refetch temps réel générique (housekeeping), switch Hôtel A→B (sans notification), cross-owner (accès API), login, infrastructure Maestro/ADB. Voir `MOB_E2E2_REPORT.md` pour le détail complet — non refait ici sauf non-régression ciblée si une modification de ce sprint touche une zone partagée (Socket.IO, `HotelReservation`, `inspectionController.js`).

## 17. Zones explicitement NON CONFIRMÉES à fermer ce sprint

Messaging (E2E + isolation), Tenant Portal (E2E + isolation + maintenance locataire), Notifications in-app réelles (au-delà de MOB-E2E), deep-links (hôtel valide + étranger refusé), Hôtel A→B **via notification/deep-link** (distinct du simple switch déjà certifié), background→foreground, cold start via deep-link, reconnexion socket (rejoin réel prouvé), perte/rétablissement réseau, comportement auth pendant une perte réseau, Inspection Fail, bug ActionLog (reproduction + correction + test).

## 18. Risques identifiés avant modification

(a) `inspectionController.js` est un fichier partagé par le chemin Inspection Pass déjà certifié 3/3 — toute correction du bug ActionLog doit être strictement additive/corrective sur le littéral fautif, sans toucher à la logique métier d'inspection, sous peine de devoir refaire une non-régression PMS complète (mandat §38). (b) `socketService.js`/`useHotelRealtime.js` sont partagés par tous les écrans hôteliers déjà certifiés — aucune modification prévue à ce stade, uniquement vérification empirique. (c) Le registre `shared/navigation/registry.json` est partagé web/mobile — lecture seule prévue, aucune modification. (d) Extension des fixtures `start-mobile-e2e.js` : strictement additive (nouveaux ids), ne touche aucun id/fixture existant utilisé par le PMS déjà certifié.

## Périmètre de ce document

Ce document couvre l'audit statique préalable. Aucune modification de code n'a été effectuée à ce stade. La suite (correction ActionLog, extension fixtures, exécution E2E réelle) est documentée dans `server/docs/POST_E2E1_REPORT.md`.
