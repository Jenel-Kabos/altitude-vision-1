# MOB-E2E-2 — Rapport final : stabilisation infrastructure + certification PMS hôtelier réel

Date : 2026-08-16. Branche `main`, HEAD `ab5ae586fab50ddce02e65ea081330d2769c6503` (**inchangé, aucun commit pendant tout le sprint**).

## 1. Résumé exécutif

Phase A (stabilisation) et Phase B (certification PMS) sont **toutes deux atteintes**. La cause exacte de l'instabilité Maestro héritée de MOB-E2E a été isolée précisément par diagnostic ADB (deux composants natifs distincts, jamais un « menu Expo » générique) et corrigée par un mécanisme entièrement déterministe (deep link direct + polling de fenêtres natives), validé à 5/5 en exécution répétée. Le cycle PMS complet — Réservation → Confirmation → Room Assignment → Check-in → Financial Readiness (blocage réel puis résolution par un second acteur Admin réel) → Check-out → Housekeeping → Inspection → Room Available — a été exécuté **3 fois de façon indépendante** sur runtime Android réel, chaque étape corroborée par les logs backend et/ou des requêtes API authentifiées, avec un score final de **3/3**. Cockpit, Maintenance (cycle complet ouvert→fermé), un rafraîchissement réel déclenché par socket (sans rechargement manuel), et le changement Hôtel A → Hôtel B ont également été certifiés. Un bug réel mineur non bloquant a été identifié et documenté (§ bugs). La portée optionnelle post-PMS (Messaging, Tenant Portal, notifications, background/cold-start, reconnexion socket, perte réseau) n'a **pas** été exécutée ce sprint — explicitement `NON CONFIRMÉ`, par choix assumé pour prioriser la stabilité 3/3 du PMS conformément à la décision prise en cours de sprint. iOS reste `NON CERTIFIÉ` (jamais exécuté). Tous les gates finaux (tests unitaires serveur et mobile, lint des trois workspaces, Expo Doctor, export Android) sont **verts**.

## 2. Git

`git status --short` : fichiers modifiés/créés spécifiquement par MOB-E2E-2 : `altimmo-app/.maestro/mob-e2e-prelaunch.sh` (nouveau), `altimmo-app/.maestro/01-launch.yaml` et `02-login.yaml` (réécrits), `altimmo-app/.maestro/_dev_client_launch.yaml` (créé puis laissé en place, non utilisé par le mécanisme final), `server/scripts/start-mobile-e2e.js` (étendu avec 3 fixtures de réservation PMS), `server/docs/MOB_E2E2_ETAT_INITIAL.md` et `MOB_E2E2_REPORT.md` (nouveaux). Le reste des fichiers modifiés/non suivis listés par `git status --short` (composants UI, thèmes, écrans, `server/scripts/start-accommodation-e2e.js`, docs `UI_MOB*`/`MOB_E2E_*`) est **hérité des sprints précédents**, non retouché ce sprint — confirmé par lecture des diffs (`HotelOperationsScreen.jsx` ne montre qu'un changement de couleur d'une ligne, antérieur à ce sprint). `git diff --check` : aucune erreur d'espace blanc (`exit 0`). HEAD `ab5ae586fab50ddce02e65ea081330d2769c6503` inchangé du début à la fin. Aucun `git add`/`commit`/`push`.

## 3. Environnement

Node v20.20.2, npm 10.8.2, `npx expo --version` 57.0.15 (`expo` en dépendance `~57.0.13`, `react-native` `0.86.2`). JDK 17 (Temurin) utilisé pour le build, JDK 26 par défaut du système resté incompatible et non touché. macOS, x86_64.

## 4. Android device/emulator

AVD `Pixel_6`, API 34, device confirmé `sdk_gphone64_x86_64`, Android 14. Déjà démarré en tout début de sprint (hérité), utilisé sans interruption majeure sur toute la durée.

## 5. iOS

**NON CERTIFIÉ.** Aucune tentative d'exécution ce sprint (comme les précédents), `xcrun simctl`/Xcode absents. Statut inchangé, jamais inféré.

---

## PHASE A — Diagnostic et stabilisation

## 6. Cause racine #1 : le lanceur natif Expo Dev Client

`adb shell dumpsys activity activities | grep topResumedActivity` a montré que le lancement par défaut d'Android (et `Maestro launchApp`) ouvre `expo.modules.devlauncher.launcher.DevLauncherActivity` — une **Activity Android distincte**, pas un composant de l'app réelle — plutôt que `.MainActivity`. C'est l'écran de sélection de serveur de développement, pas un « menu » au sens JS/RN.

## 7. Cause racine #2 : le tooltip natif « menu développeur »

Un **second** composant, entièrement distinct du premier : une fenêtre Android additionnelle empilée sur `MainActivity`, apparaissant de façon asynchrone (observé de <1s à >10s après création de l'activité, mesuré empiriquement). Diagnostiqué par `adb shell dumpsys window windows | grep -c "^  Window #.*MainActivity"` — 2 fenêtres = tooltip présent, 1 = absent. Confirmé invisible à l'arbre d'accessibilité React Native (l'attente Maestro d'un texte JS restait bloquée tant que cette fenêtre existait), donc bien une fenêtre native qui intercepte, pas un problème d'affichage JS.

## 8. Mécanisme de correction : lancement déterministe

Nouveau script `altimmo-app/.maestro/mob-e2e-prelaunch.sh` : `am force-stop` puis lancement direct par deep link (`exp+altimmo-app://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081`, format lu dans les logs réels `expo run:android` d'un sprint antérieur, jamais inventé), contournant totalement `DevLauncherActivity`. Puis boucle de polling du nombre de fenêtres `MainActivity` (`dumpsys window windows`) : dissolution du tooltip par un tap ciblé dès détection de 2 fenêtres, déclaration de l'état « prêt » seulement après **12 lectures consécutives** à 1 fenêtre (~12s sans réapparition, marge choisie au-delà du délai maximal observé de ~10s), boucle bornée à 35s. **Aucun `sleep` fixe utilisé comme stratégie principale** — chaque itération vérifie une condition ADB réelle.

## 9. Validation de la stabilisation

5/5 exécutions consécutives de `mob-e2e-prelaunch.sh` + `01-launch.yaml` (assertion `DÉCOUVRIR`) réussies. 5/5 combiné avec `02-login.yaml` (login réel `rental-owner-e2e@example.test`). Un premier essai à 3 lectures consécutives (au lieu de 12) avait échoué 1 fois sur 3 — corrigé en augmentant le seuil, revalidé ensuite à 5/5 stable.

## 10. Sélecteurs Maestro

`02-login.yaml` utilise exclusivement des `accessibilityLabel`/textes réels (« Adresse email », « Mot de passe », `^Se connecter$`), jamais de texte halluciné. Identifiants passés via `-e TEST_EMAIL=... -e TEST_PASSWORD=...` (le bloc `env:` interne au flow n'interpole pas fiablement, confirmé de nouveau ce sprint, mécanisme déjà connu depuis MOB-E2E).

## 11. Aucun `testID` ajouté au code de production

Le mandat autorisait l'ajout de `testID`/`accessibilityLabel` minimal si un contrôle métier stable en manquait réellement. Ce ne fut jamais nécessaire ce sprint : tous les boutons/écrans hôteliers touchés (`HotelOperationsScreen`, `HotelHousekeepingScreen`, `HotelCockpitScreen`, `HotelMaintenanceScreen`) exposaient déjà un texte réel stable suffisant, utilisé pour toutes les interactions (via taps ADB directs positionnés par `uiautomator dump` — voir §13).

## 12. Grouped stability batch (login, dark mode, portfolio, cross-owner)

**Partiellement exécuté**, pas en tant que batch Maestro dédié : login re-exécuté à de multiples reprises avec succès (y compris après expiration de session, §26), cross-owner re-vérifié (§23). Dark mode et owner portfolio **non re-testés** ce sprint (déjà certifiés PASS en MOB-E2E, non remis en cause, mais `NON CONFIRMÉ` pour ce sprint spécifiquement faute de temps — priorité donnée à la stabilité 3/3 du PMS, cf. décision utilisateur §37).

## 13. Méthode de tap fiable

`adb shell uiautomator dump` + parsing des `bounds="[x1,y1][x2,y2]"` pour calculer le centre exact en pixels device réels — méthode systématiquement utilisée pour toutes les interactions PMS de ce sprint, à la place de coordonnées déduites de captures d'écran (source d'erreurs de mise à l'échelle rencontrées et corrigées en cours de route, voir §38 bugs process).

---

## PHASE B — Certification PMS hôtelier réel

## 14. Backend de test étendu

`server/scripts/start-mobile-e2e.js` étendu avec 3 réservations hôtelières pré-seedées sur Hôtel A (`reservationA/B/C`, statut `confirmed`, mêmes montants/dates), documentées explicitement en commentaire comme pré-seed autorisé par le mandat (§30), jamais présentées comme une création UI. Toute la suite du cycle (affectation, check-in, financier, check-out, ménage, inspection) est pilotée par de vraies actions applicatives.

## 15. Pourquoi la création de réservation n'est pas UI-certifiée

Aucun écran mobile de création de réservation n'a été localisé dans le temps du sprint ; le mandat permet explicitement le pré-seed dans ce cas, à condition de le documenter honnêtement — fait ici. **Statut : `NON CONFIRMÉ` pour la création UI spécifiquement**, le reste du cycle étant entièrement UI-piloté.

## 16. Modèle de rôles respecté

Le Proprietaire (`rental-owner-e2e@example.test`) exécute toutes les actions opérationnelles (affectation, check-in, check-out, ménage, inspection) via l'app mobile réelle. Les actions financières (facturation, paiement, allocation) — qui n'ont **aucune** UI mobile par design — ont été exécutées par un second acteur réel distinct, `owner-e2e@example.test` (rôle `Admin`), via des appels API authentifiés directs. **Aucune permission du Owner n'a été élargie.**

## 17. Passe 1/3 — Réservation C (RES-2026-000003)

Room Assignment : `Auto` → `POST /api/hotels/room-assignments/auto` 200. Check-in : `PATCH .../check-in` 200. Financial readiness initiale : `blocked`, 4 blockers réels (`FINANCIAL_DOCUMENT_NOT_ISSUED`, `FINANCIAL_BALANCE_REMAINING`, `FINANCIAL_PAYMENT_NOT_SETTLED`, `FINANCIAL_LINES_NOT_FINALIZED`). Résolution Admin : `finalize-lines` → `issue` (facture `FAC-000051-2026-000001`) → `POST /financial/hotel/payments` → `confirm` → `allocations` (201). Readiness finale : `{allowed:true, status:"ready", blockers:[]}`. Check-out : `PATCH .../check-out` 200, `hotel_checkout.completed` loggé. Housekeeping : `start`/`complete` 200. Inspection : créée automatiquement, `approve` 200. Chambre A1 confirmée `available` via API.

## 18. Passe 2/3 — Réservation B (RES-2026-000002)

Séquence identique, reservation `66e2...096`, facture `FAC-000051-2026-000002`. Une expiration de session (`JWT_EXPIRES_IN=1h` dépassé par le temps réel écoulé) est survenue entre les passes — gérée proprement par l'app (redirection Login, aucun crash), re-authentification effectuée, cycle repris et terminé avec succès jusqu'à chambre `available`.

## 19. Passe 3/3 — Réservation A (RES-2026-000001)

Séquence identique, reservation `66e2...095`. Terminée avec succès jusqu'à chambre `available`.

## 20. Résultat stabilité PMS

**3/3 PASS.** Vérification finale : les 8 chambres de l'Hôtel A (`A1`–`A8`) toutes `available`, les 3 réservations toutes `checked_out`. Chaque étape de chaque passe corroborée par au moins un appel backend réel (log serveur ou réponse API), jamais uniquement par l'état visuel local de l'app.

## 21. Cockpit hôtelier

`HotelCockpitScreen` ouvert avec de vraies données (`GET /api/dashboard-analytics/hotels`, 200) : compteurs `Occupation`, `Arrivées`, `Départs`, `À nettoyer` (avec détail « N tâche(s) ouverte(s) »), `À inspecter`, `Maintenance` (avec détail « N chambre(s) hors service ») — tous vérifiés cohérents avec l'état réel du backend à l'instant du test (housekeeping:1, outOfServiceRooms:1 confirmés correspondre exactement au texte affiché).

## 22. Rafraîchissement temps réel prouvé

En laissant l'écran Cockpit ouvert **sans aucune action manuelle**, un `POST /api/housekeeping` déclenché côté API a fait passer le compteur affiché de « 1 tâche(s) ouverte(s) » à « 2 tâche(s) ouverte(s) », corrélé dans les logs backend par un `GET /api/dashboard-analytics/hotels` automatique **immédiatement après** le `POST`, prouvant un vrai refetch déclenché par événement socket (`emitHotelEvent`/`useHotelRealtime`), pas une simple mutation locale de l'état à partir du payload.

## 23. Cross-owner (non-régression)

Re-vérifié par appel API réel : le compte `owner-e2e@example.test` (Admin, mais non manager de l'Hôtel A) reçoit `403 Accès refusé` sur `GET /api/hotel-reservations/owner?hotelId=<hotelA>` — confirme l'isolation deux fois prouvée en MOB-E2E, revalidée sur le backend de ce sprint.

## 24. Changement Hôtel A → Hôtel B

Sur runtime réel : sélection Hôtel B déclenche `Room hôtel quittée` (hotelId A) puis `Room hôtel rejointe` (hotelId B) dans les logs Socket.IO, suivi d'un `GET .../owner?hotelId=<hotelB>` 200 retournant une liste vide (Hôtel B n'a jamais reçu de réservation ce sprint) — aucune donnée de l'Hôtel A n'est restée affichée après le switch.

## 25. Maintenance — cycle complet

Un ticket a été pré-seedé via API (`POST /api/maintenance`, catégorie `plumbing`) faute d'UI mobile de création de ticket (confirmé par lecture du code source : l'écran n'expose que des actions sur tickets existants, jamais de création — cohérent avec le principe finance/maintenance-creation Web/Admin-only). Depuis l'app mobile réelle : `Démarrer` (`PATCH .../start` 200) → `Résoudre` (`PATCH .../resolve` 200) → tentative `Ré-inspecter` (refus applicatif correct, §39) → `Clôturer` (`PATCH .../close` 200). Cycle métier complet certifié à l'exception de la création (non UI-certifiée, documentée honnêtement).

## 26. Gestion de l'expiration de session

Observée deux fois en cours de sprint (`JWT_EXPIRES_IN=1h` dépassé par le temps réel écoulé pendant les manipulations). Comportement correct à chaque fois : `401` intercepté par l'app, redirection propre vers l'écran de connexion, aucun crash, aucune corruption d'état. Reconnexion réussie à chaque fois. **Comportement positif confirmé, pas un bug.**

## 27. Housekeeping — détail des trois passes

Chaque passe a suivi exactement `En attente → (Démarrer) → En cours → (Terminer) → Terminée → (Inspecter, auto-création de l'inspection) → (Approuver) → chambre disponible`. Aucune divergence entre les 3 exécutions.

## 28. Inspection — scénario Fail

**NON CONFIRMÉ.** Seul le scénario Pass (Approuver) a été exécuté, 3 fois. Le scénario Rejeter (mise hors service + re-cycle ménage/inspection) n'a pas été testé ce sprint, par choix de priorisation (3x stabilité PMS nominal privilégiée sur les scénarios secondaires, décision utilisateur explicite §37).

## 29. Portée optionnelle post-PMS

**Toutes `NON CONFIRMÉES` ce sprint** : Messaging, Tenant Portal, Notifications/deep-links (au-delà de ce qui était déjà certifié en MOB-E2E), background/cold-start, reconnexion socket, perte réseau. Choix assumé et communiqué : temps restant concentré sur l'obtention réelle du 3/3 PMS plutôt que sur l'extension de portée, conformément à la décision utilisateur prise explicitement en cours de sprint (§37).

## 30. Fixture pré-seed — rappel de conformité mandat

Le pré-seed des 3 réservations respecte le mandat §30 : autorisé explicitement quand la création UI n'est pas atteignable dans le temps du sprint, à condition de le documenter honnêtement et de piloter tout le reste du cycle par de vraies actions applicatives — ce qui a été fait intégralement.

---

## BUGS ET OBSERVATIONS

## 31. Bug réel P3 (non bloquant) : échec silencieux du log d'audit à la création d'inspection

`POST /api/inspections` déclenche systématiquement, à chaque création (observé 3 fois, 3/3 reproductions), une erreur interne journalisée : `[ActionLog] Erreur lors de l'enregistrement: ActionLog validation failed: typeAction: 'CREATION' is not a valid enum value for path 'typeAction'`. L'opération métier elle-même **réussit** (201, inspection bien créée, cycle non affecté) — uniquement l'entrée d'audit `ActionLog` échoue silencieusement. Impact : perte de traçabilité d'audit pour cet événement spécifique, aucun impact fonctionnel utilisateur. Classé **P3, non bloquant** pour le verdict.

## 32. Non-bug : émail Zoho en échec pendant les notifications

`ZohoMailService` échoue systématiquement (`Erreur lors de l'envoi de l'email`) lors des notifications de réservation (assignation, check-in, check-out). **Comportement attendu et correct** : `safeTestEnv`/`externalNetworkGuard.js` neutralisent délibérément les credentials externes réels en environnement de test — confirmé en lisant le code, pas un bug produit.

## 33. Non-bug : re-tentative de « Ré-inspecter » refusée sur ticket pré-seedé

`HotelMaintenanceScreen` refuse la ré-inspection d'un ticket créé directement via API (sans tâche de ménage d'origine associée), avec un message d'erreur clair (« Aucune tâche de ménage d'origine trouvée pour cette chambre »). Comportement de validation correct — un ticket créé par le vrai chemin (inspection échouée) aurait cette association. Pas un bug, artefact du pré-seed API assumé et documenté.

## 34. Non-bug : investigation initiale sur les boutons Cockpit/Ménage/Maintenance manquants

Une investigation a été ouverte sur la non-apparition apparente de la rangée Cockpit/Ménage/Maintenance sur `HotelOperationsScreen`. Cause identifiée après vérification : la rangée est correctement conditionnée par `hotelId` (état local, jamais persistant entre navigations) et se trouve **en bas d'une liste défilante** — sa non-apparition dans plusieurs captures successives provenait exclusivement d'un défilement insuffisant ou d'un oubli de re-sélection de l'hôtel après navigation arrière, jamais d'un défaut du code. Confirmé après relecture du composant (`{hotelId && <View>...</View>}`, ligne 127) : aucun changement nécessaire.

## 35. Non-bug confirmé : pas de socket-emit sur simple mutation de statut de chambre

`PATCH /api/hotels/rooms/:id` (changement direct de statut, hors ménage/inspection) n'émet aucun événement `emitHotelEvent` — confirmé par lecture de `roomController.js`. Le Cockpit ne se rafraîchit donc pas automatiquement sur ce type de mutation isolée, contrairement aux événements ménage/inspection qui, eux, émettent bien (§22). Comportement de conception, pas un bug — non testé comme un défaut car ce chemin n'a pas de UI mobile déclenchant une telle mutation isolée.

---

## GATES FINAUX

## 36. Tests unitaires serveur

`npm run test:unit` (server) : **116/116 suites, 1331/1331 tests, 100% vert.** Deux échecs observés lors d'une première exécution concurrente avec l'émulateur/backend de test actifs (`propertyRoutes.test.js` timeout, `hotelOperationsRoutes.test.js` 401 au lieu de 403) — confirmés **flaky, pas des régressions** : ré-exécutés isolément (70/70 passent), puis suite complète re-exécutée après arrêt des processus de test annexes (116/116, 1331/1331). Aucun fichier de logique métier serveur n'a été modifié ce sprint (seul `start-mobile-e2e.js`, script de fixtures).

## 37. Décision utilisateur sur la portée

Face au choix explicite proposé en cours de sprint entre (a) 2 passes PMS supplémentaires en sacrifiant la portée optionnelle, (b) 1 passe supplémentaire avec verdict sous réserve assumé, (c) arrêt immédiat de la répétition PMS, l'utilisateur a choisi **(a)** : obtenir un vrai 3/3 PMS, sacrifier entièrement Messaging/Tenant Portal/Notifications/background/reconnexion/perte réseau pour ce sprint.

## 38. Bugs process rencontrés et corrigés (transparence méthodologique)

Plusieurs taps ADB ont initialement manqué leur cible par confusion entre coordonnées de capture d'écran affichée (900×2000) et coordonnées brutes device (1080×2400, facteur ×1,2) — corrigé systématiquement par relecture de `uiautomator dump` (bounds exacts) plutôt que par calcul depuis les captures. Aucun impact sur la validité des résultats finaux (chaque étape critique re-vérifiée par log/API après correction du tap).

## 39. Lint serveur

`npm run lint` (server) : **0 erreur**, 110 warnings pré-existants (non liés à ce sprint).

## 40. Lint client

`npm run lint` (client) : **0 erreur**, 269 warnings pré-existants.

## 41. Lint mobile

`npm run lint` (altimmo-app) : **0 erreur**, 104 warnings pré-existants (essentiellement `import/first` sur fichiers de test).

## 42. Tests unitaires mobile

`npm run test:coverage` (altimmo-app) : **40/40 suites, 358/358 tests, 100% vert.**

## 43. Expo Doctor

`npm run doctor` : **21/21 checks passed. No issues detected.**

## 44. Export Android

`npm run export` : **PASS**, bundle Android généré (`_expo/static/js/android/index-*.hbc`, 6.7MB) + assets + `metadata.json`.

## 45. `.env` mobile

Restauré aux valeurs de production exactes retrouvées dans le dernier commit git où `.env` était suivi (avant mise sous `.gitignore`) : `API_URL`/`EXPO_PUBLIC_API_URL`/`EXPO_PUBLIC_SOCKET_URL` → `https://altitude-vision.onrender.com`, `EXPO_PUBLIC_SENTRY_DSN` renseigné (DSN réel), `GOOGLE_MAPS_API_KEY` inchangée. Vérifié par lecture finale du fichier.

## 46. Processus temporaires arrêtés

Backend de test (`start-mobile-e2e.js` + `server.js` associé, PID forcé après délai de grâce dépassé) et Metro (`expo start --dev-client`) arrêtés proprement en fin de sprint. Ports `5057` et `8081` confirmés libres.

---

## MATRICE DE CERTIFICATION

## 47. Matrice — Infrastructure

| Élément | Statut |
|---|---|
| Lancement déterministe (deep link + polling fenêtres) | PASS 5/5 |
| Dissolution tooltip natif | PASS 5/5 |
| Login (accessibilityLabel + `-e`) | PASS |
| Stabilité batch groupée (login/dark mode/portfolio/cross-owner) | Partiel — login/cross-owner PASS, dark mode/portfolio NON CONFIRMÉ ce sprint |

## 48. Matrice — PMS

| Étape | Passe 1 | Passe 2 | Passe 3 |
|---|---|---|---|
| Room Assignment (Auto) | PASS | PASS | PASS |
| Check-in | PASS | PASS | PASS |
| Financial blocked→ready (Admin réel) | PASS | PASS | PASS |
| Check-out | PASS | PASS | PASS |
| Housekeeping start/complete | PASS | PASS | PASS |
| Inspection approve | PASS | PASS | PASS |
| Room → available | PASS | PASS | PASS |
| **Score global** | **3/3 PASS** | | |

## 49. Matrice — Écrans/fonctions hôtelières

| Élément | Statut |
|---|---|
| HotelOperationsScreen | PASS |
| HotelCockpitScreen | PASS |
| HotelHousekeepingScreen | PASS |
| HotelMaintenanceScreen (cycle complet) | PASS |
| Refetch temps réel (socket) | PASS, prouvé |
| Switch Hôtel A→B | PASS |
| Cross-owner | PASS (non-régression) |
| Inspection Fail | NON CONFIRMÉ |
| Création réservation via UI | NON CONFIRMÉ (pré-seed documenté) |

## 50. Matrice — Portée optionnelle

| Élément | Statut |
|---|---|
| Messaging | NON CONFIRMÉ |
| Tenant Portal | NON CONFIRMÉ |
| Notifications/deep-links (au-delà de MOB-E2E) | NON CONFIRMÉ |
| Background/cold-start | NON CONFIRMÉ |
| Reconnexion socket | NON CONFIRMÉ |
| Perte réseau | NON CONFIRMÉ |
| iOS | NON CERTIFIÉ |

## 51. Matrice — Bugs

| ID | Sévérité | Description | Bloquant verdict ? |
|---|---|---|---|
| BUG-1 | P3 | `ActionLog` rejette `typeAction:"CREATION"` à la création d'inspection (opération métier non affectée) | Non |

---

## 52. Q&A factuelles

**Q: Le lanceur natif Dev Client a-t-il été identifié précisément ?** R: Oui — `DevLauncherActivity`, confirmé par `dumpsys activity activities`.
**Q: Le tooltip développeur est-il dans l'arbre RN ?** R: Non, confirmé fenêtre native distincte via `dumpsys window windows`.
**Q: Un `sleep` fixe a-t-il été utilisé comme stratégie principale ?** R: Non — polling de condition ADB réelle à chaque itération.
**Q: Le mécanisme de lancement a-t-il été validé en répétition ?** R: Oui, 5/5.
**Q: La réservation PMS a-t-elle été créée via l'UI mobile ?** R: Non, pré-seedée (mandat §30), documenté honnêtement.
**Q: Qui a exécuté les actions financières ?** R: Un second acteur Admin réel (`owner-e2e@example.test`), jamais le Owner.
**Q: Les permissions du Owner ont-elles été élargies ?** R: Non.
**Q: Le cycle PMS a-t-il été exécuté 3 fois indépendamment ?** R: Oui, avec 3 réservations distinctes.
**Q: Chaque étape a-t-elle été corroborée côté backend ?** R: Oui, logs et/ou appels API à chaque étape critique.
**Q: Le Cockpit affiche-t-il de vraies données ?** R: Oui, vérifié cohérent avec l'état backend réel.
**Q: Un refetch temps réel a-t-il été prouvé (pas juste une mutation locale) ?** R: Oui, `GET` backend observé juste après l'événement déclencheur.
**Q: Le cycle Maintenance complet a-t-il été exécuté ?** R: Oui (hors création, pré-seedée).
**Q: Le scénario Inspection Fail a-t-il été exécuté ?** R: Non, NON CONFIRMÉ.
**Q: Le switch Hôtel A→B a-t-il montré des données périmées ?** R: Non, rejoin socket propre confirmé.
**Q: Le cross-owner a-t-il été re-vérifié ce sprint ?** R: Oui, via API, 403 confirmé.
**Q: Des `testID` ont-ils été ajoutés au code app ?** R: Non, aucun nécessaire.
**Q: Du code métier backend a-t-il été modifié ?** R: Non, uniquement le script de fixtures de test.
**Q: L'UI mobile a-t-elle été modifiée pour s'adapter aux tests ?** R: Non.
**Q: Des services de production réels ont-ils été appelés ?** R: Non (email neutralisé par `safeTestEnv`, confirmé).
**Q: Un build EAS cloud a-t-il été utilisé ?** R: Non, build local uniquement (hérité, non rebuild ce sprint).
**Q: Le `.env` mobile a-t-il été restauré exactement aux valeurs de production ?** R: Oui, retrouvées dans le dernier commit git où le fichier était suivi.
**Q: Le backend de test a-t-il été arrêté en fin de sprint ?** R: Oui, confirmé (ports libres).
**Q: Les tests unitaires serveur sont-ils à 100% ?** R: Oui, 1331/1331 (après confirmation que 2 échecs initiaux étaient flaky, non liés au sprint).
**Q: Les tests unitaires mobile sont-ils à 100% ?** R: Oui, 358/358.
**Q: Le lint des trois workspaces est-il sans erreur ?** R: Oui (warnings pré-existants uniquement).
**Q: Expo Doctor est-il à 21/21 ?** R: Oui.
**Q: L'export Android a-t-il réussi ?** R: Oui.
**Q: iOS a-t-il été exécuté ce sprint ?** R: Non, `NON CERTIFIÉ`, jamais inféré.
**Q: Un commit ou push a-t-il été effectué ?** R: Non, aucun, HEAD inchangé.
**Q: La portée optionnelle (Messaging etc.) a-t-elle été couverte ?** R: Non, `NON CONFIRMÉ`, choix assumé par décision utilisateur explicite en cours de sprint.

---

## 53. Périmètre de code touché — récapitulatif final

Nouveau : `altimmo-app/.maestro/mob-e2e-prelaunch.sh`, `_dev_client_launch.yaml`, `server/docs/MOB_E2E2_*.md`. Modifié : `altimmo-app/.maestro/01-launch.yaml`, `02-login.yaml`, `server/scripts/start-mobile-e2e.js` (fixtures PMS additionnelles uniquement). Aucun autre fichier de production (app ou serveur) modifié par ce sprint.

## 54. Limites connues et honnêtes de ce rapport

Le scénario Inspection Fail, la portée optionnelle post-PMS complète, et le batch de stabilité groupée (dark mode/portfolio) n'ont pas été ré-exécutés ce sprint — statuts hérités de MOB-E2E non invalidés mais non re-prouvés ici. Toute lecture de ce rapport doit distinguer ce qui a été **réellement réexécuté ce sprint** (Phase A complète, PMS 3/3, Cockpit, Maintenance, refetch temps réel, switch hôtel, cross-owner, gates) de ce qui reste hérité et non retouché.

## 55. Recommandation pour un sprint suivant éventuel

Si une suite est engagée : (1) exécuter le scénario Inspection Fail et le cycle maintenance qui en découle nativement (sans pré-seed API) pour lever le dernier `NON CONFIRMÉ` du PMS ; (2) créer des flows Maestro dédiés pour encoder le cycle PMS de façon rejouable automatiquement plutôt que par pilotage manuel ADB ; (3) couvrir la portée optionnelle (Messaging, Tenant Portal, notifications) sciemment laissée de côté ce sprint ; (4) investiguer le bug P3 `ActionLog`/`typeAction` (fix probable trivial : ajouter `'CREATION'` à l'enum ou utiliser une valeur existante lors de la création d'inspection).

## 56. Verdict final

**Conditions requises pour `CERTIFIÉ VERT`** : infrastructure stable ET PMS nominal 3/3 PASS ET aucun problème bloquant P0/P1/P2 ET tous les gates standards verts (tests unitaires, lint, Doctor 21/21, export Android).

Toutes ces conditions sont réunies : infrastructure stabilisée et validée 5/5, PMS nominal 3/3 PASS avec corroboration backend systématique, seul bug identifié classé P3 non bloquant, et les quatre gates finaux (1331/1331 tests serveur, 358/358 tests mobile, lint 0 erreur ×3, Doctor 21/21, export Android PASS) tous verts.

**MOB-E2E-2 ANDROID : CERTIFIÉ VERT**

Ce verdict porte strictement sur Android et sur le périmètre réellement exécuté ce sprint (infrastructure + PMS core + Cockpit/Maintenance/refetch temps réel/switch hôtel/cross-owner). La portée optionnelle post-PMS (Messaging, Tenant Portal, notifications étendues, background/cold-start, reconnexion socket, perte réseau), le scénario Inspection Fail, et le batch de stabilité groupée dark mode/portfolio restent explicitement **`NON CONFIRMÉ`** — non couverts par ce verdict, à traiter dans un sprint ultérieur si nécessaire. **iOS reste `NON CERTIFIÉ`**, jamais exécuté.
