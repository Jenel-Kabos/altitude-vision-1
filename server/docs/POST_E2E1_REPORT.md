# POST-E2E-1 — Rapport final : Messaging, Tenant Portal, Notifications, Deep-links, Socket reconnect, Network loss, Inspection Fail

Date : 2026-08-17. Branche `main`, HEAD `ab5ae586fab50ddce02e65ea081330d2769c6503` (**inchangé, aucun commit pendant tout le sprint**).

## 1. Résumé exécutif

Ce sprint devait fermer les zones explicitement laissées `NON CONFIRMÉ` par MOB-E2E-2. En les testant réellement, il a révélé que **Messaging était totalement non fonctionnel pour tout client ordinaire** (P0, aucune conversation possible, ni lecture ni envoi, même dans une conversation dont le client est légitimement participant) et que **les deep-links hôteliers ne routaient nulle part** (P1, config de linking incomplète). Les deux ont été corrigés à la source, minimalement, puis re-testés avec succès en conditions réelles. Tenant Portal, Notifications (affichage), Hotel A→B, isolation croisée, reconnexion Socket.IO, perte/rétablissement réseau et Inspection Fail ont tous été certifiés PASS avec preuve backend. Un troisième bug réel (navigation de notification `message_staff` n'ouvrant pas la conversation) et un quatrième (statut HTTP 500 au lieu de 403 sur un refus d'accès conversation) ont été identifiés et documentés, non corrigés (hors du scope minimal, second nécessite un examen plus large). Background/foreground et cold-start via deep-link n'ont pas été testés explicitement (temps insuffisant après la découverte et la correction des deux bugs P0/P1) — `NON CONFIRMÉ`, assumé.

## 2. Verdict

**POST-E2E-1 ANDROID : GO SOUS RÉSERVES** (pas `CERTIFIÉ VERT` — voir §50 pour la justification précise).

## 3. Git initial

`git status --short`/`git diff --stat` identiques à la clôture de MOB-E2E-2 (fichiers hérités des sprints précédents, non retouchés). Aucune modification avant le début de ce sprint. `git diff --check` : `exit 0`.

## 4. Infrastructure réutilisée

Mécanisme de lancement déterministe (`mob-e2e-prelaunch.sh`, deep-link + polling fenêtres, certifié 5/5 en MOB-E2E-2) réutilisé sans modification tout au long de ce sprint, y compris après chaque relance nécessitée par une session expirée ou un rechargement JS. Aucun retour à un `sleep` fixe.

## 5. Android/ADB

AVD `Pixel_6`, API 34, hérité. Un incident `adb kill-server`/`start-server` (nécessaire pour résoudre une erreur transitoire `Can't find service: activity`) a fait perdre les redirections de port (`adb reverse tcp:8081`/`tcp:5057`) — diagnostiqué et rétabli explicitement, documenté ici pour transparence méthodologique (§43).

## 6. Maestro

CLI 2.8.0, réutilisé. `openLink` confirmé comme le mécanisme fiable pour tester un deep-link sur une app déjà lancée (contrairement à `adb shell am start -a VIEW`, qui déclenche le chooser/lanceur natif Expo Dev Client au lieu d'atteindre l'app directement — même classe de problème que le lanceur diagnostiqué en MOB-E2E-2, confirmé se reproduire aussi pour le scheme `altimmo://` propre à l'app, pas seulement `exp+altimmo-app://`).

## 7. Backend de test

`server/scripts/start-mobile-e2e.js` étendu (additif) : Owner B + Hôtel C (fixture d'isolation), Tenant B + Locataire B + Contrat B (fixture d'isolation), `JWT_EXPIRES_IN` relevé de 1h à 4h (réduction du bruit d'expiration en cours de manipulation manuelle, comportement d'expiration lui-même inchangé et déjà certifié).

## 8. Fixtures

Ajoutées ce sprint : `owner-b-e2e@example.test`/`E2eOwnerB!2026` (Proprietaire, gère Hôtel C uniquement, étranger à rental-owner-e2e), `tenant-b-e2e@example.test`/`E2eTenantB!2026` (Locataire B, bail distinct sur un bien distinct — un index unique `one_open_contract_per_property_and_type` interdisait la réutilisation du bien du Locataire A, corrigé en créant une Property dédiée). Réutilisées : tous les comptes/hôtels/réservations de MOB-E2E-2.

## 9. Messaging — architecture (état réel du code, avant correction)

`server/routes/conversationRoutes.js`/`messageRoutes.js` montaient `requireTenantScope` (middleware bloquant, 403 si aucun tenant résolu) sur **toutes** leurs routes, y compris `POST /conversations/start` (le seul chemin mobile réel, via `DetailAnnonceScreen.jsx` → bouton « Contacter »). Or `OrgMembership` (source unique de résolution tenant) n'est **jamais** attribuée à un inscription normale — seuls staff/exploitants en reçoivent une (`start-accommodation-e2e.js:144-147`). Un client ordinaire n'a donc structurellement aucun tenant propre. Conséquence : 403 systématique, y compris pour lire/répondre dans une conversation dont ce client est déjà légitimement participant (le contrôle réel — participant/sender/receiver — existe bien dans chaque contrôleur, mais n'était jamais atteint, bloqué en amont par le middleware).

## 10. Messaging — reproduction du bug (avant correction)

`POST /api/conversations/start` (client réel, `client-e2e@example.test`, via le bouton « Contacter » sur un bien réel) → `403 {"message":"Accès refusé : aucun tenant SaaS actif résolu pour cet utilisateur."}`, erreur `TenantContextError` tracée à `middleware/tenantContext.js:68`. Confirmé 2 fois (deux tentatives indépendantes, deux redémarrages de backend).

## 11. Messaging — spécification de correction (fournie par l'utilisateur)

Client ordinaire (aucun tenant propre) → ouvre une conversation depuis une ressource métier → le backend déduit le tenant depuis cette ressource (jamais depuis l'appartenance du client) → conversation envoyée au staff de ce tenant → le propriétaire de la ressource n'est jamais participant automatiquement. Staff → utilise son propre tenant sélectionné. Mise en relation uniquement via un workflow métier explicite (jamais automatique depuis une simple consultation d'annonce).

## 12. Messaging — correction appliquée

`conversationRoutes.js`/`messageRoutes.js` : `requireTenantScope` → `attachTenantContext` (variante non bloquante déjà existante dans `middleware/tenantContext.js`, prévue explicitement pour ce cas). `conversationController.js`/`messageController.js` : chaque assertion de frontière tenant (`assertResourceTenant`) gardée par `if (req.platformTenant)` — jamais retirée pour un acteur qui a un tenant réel (le staff), seulement rendue non bloquante pour un client qui n'en a structurellement aucun ; l'autorisation réelle (participant/sender/receiver, déjà présente à chaque site d'appel) n'a été ni retirée ni affaiblie nulle part. `startConversation` : nouvelle fonction `resolveConversationTenantId()` qui, pour un client, résout le tenant depuis le `propertyId` fourni via `resolveResourceTenant({resourceType:'Property', ...})` (mécanisme déjà existant, déjà utilisé ailleurs pour exactement ce cas) — jamais depuis l'appartenance du client. `tenantConversationFilter()` corrigé (le filtre `{tenant: activeTenantId(req)}` avec `activeTenantId` `undefined` n'agissait PAS comme « tout accepter », contrairement à l'hypothèse initiale — vérifié empiriquement, corrigé en rendant le filtre entier no-op quand l'acteur n'a pas de tenant propre, les requêtes appelantes étant déjà bornées par `participants`/`sender`/`receiver`).

## 13. Messaging — E2E après correction

Acteur A (`client-e2e`, réel, via bouton « Contacter » sur « Studio Location Activation E2E Mobile ») → `POST /conversations/start` → **200**, conversation créée avec `tenant` réel résolu depuis le bien (`66e200000000000000000044`), navigation automatique vers `Messages > Chat`, message affiché à l'écran réel. Acteur staff (`owner-e2e`, Admin) → `POST /api/messages` avec le `conversationId` → **201**, message persisté. Acteur A relit via `GET /api/conversations/:id/messages` → les deux messages apparaissent, dans l'ordre, avec les bons expéditeurs. Confirmé également en UI réelle (capture d'écran Chat avec les deux messages).

## 14. Messaging — persistance confirmée

Chaque message vérifié directement en base via l'API (`sender`/`receiver`/`content`/`conversation` corrects), pas seulement affiché côté client — aucune mutation locale non confirmée par le serveur.

## 15. Messaging — réaltime

`new-message`/`new-staff-message` émis par Socket.IO à chaque envoi (confirmé par lecture du code, mécanisme inchangé). Non re-testé en direct avec deux devices simultanés ce sprint (un seul émulateur disponible) — `NON CONFIRMÉ` pour la réception temps réel spécifiquement (la persistance et le polling REST, eux, sont confirmés).

## 16. Messaging — isolation

Un tiers non participant (`tenant-e2e`, sans lien avec la conversation) tente `GET /api/conversations/:id` → refusé (`{"message":"Accès refusé"}`, `assertConversationAccess` lève bien l'erreur) — **mais renvoyé en HTTP 500 au lieu de 403** (bug distinct, pré-existant, voir §36). Aucune donnée de la conversation n'a fuité dans la réponse d'erreur.

## 17. Messaging — bug additionnel découvert (non corrigé)

`ConversationsScreen.jsx` (liste mobile) appelle `GET /conversations` (qui exclut explicitement `isStaffInbox:true`, le seul type de conversation qu'un client ordinaire peut avoir) au lieu de `GET /conversations/my-inbox` (qui existe déjà, spécifiquement prévu pour « un client/propriétaire ne voit que SA propre conversation »). Conséquence : un client qui revient plus tard sur l'onglet Messagerie voit une liste vide, alors que sa conversation existe bien et fonctionne (accessible directement depuis « Contacter » à nouveau, qui la retrouve). **Non corrigé** — décision explicite de rester strictement dans le scope du bug tenant-scope démontré, pour éviter d'élargir la surface touchée sous contrainte de temps.

## 18. Tenant Portal — architecture (rappel, déjà audité en amont, non modifié)

`resolveLocataireForUser(req.user.id)` unique source de résolution, jamais un ID fourni par le client. 6 onglets réels : Accueil, Mon bail, Paiements, Documents, Préavis, Maintenance.

## 19. Tenant Portal — E2E

Login réel `tenant-e2e@example.test` → Profil > Espace locataire → Dashboard affiche des données réelles et cohérentes avec la fixture (« Villa E2E Brazzaville », bail 17/02/2026→17/02/2027, caution 70000 FCFA). Les 6 onglets confirmés présents et navigables sur device réel (scroll horizontal de la barre d'onglets nécessaire, tous atteints).

## 20. Tenant maintenance — E2E

Formulaire réel (catégorie « Plomberie », description saisie au clavier réel) → « Envoyer la demande » → `POST /api/tenant-portal/maintenance` → **201** confirmé en log, dialogue « Demande envoyée » affiché, ticket visible immédiatement sous « Suivi des interventions » (« Plomberie · Ouvert »).

## 21. Tenant ownership — isolation

Locataire B (`tenant-b-e2e`) interroge `GET /api/tenant-portal/maintenance` → liste **vide**, ne contient pas le ticket du Locataire A créé à l'instant. Confirmé structurellement impossible d'accéder aux données d'un autre locataire (scoping toujours dérivé de `req.user.id`, jamais d'un ID fourni par le client).

## 22. Notifications — architecture (rappel, non modifié)

Résolveur canonique unique confirmé (`resolveNavigation()`, `notificationsService.js`), pas de table dupliquée.

## 23. Notifications in-app — E2E

Notification réelle (réponse du staff dans Messaging) apparaît avec le bon badge (« 1 »), le bon expéditeur (« Administrateur E2E »), le bon contenu. Tap → `PATCH /api/notifications/:id/read` **200** confirmé (marquage lu fonctionne). **Mais** la navigation n'ouvre pas la conversation spécifique — elle atterrit sur l'onglet Messages générique (vide, cf. §17). Cause probable : le type `message_staff` n'a pas de `destination` explicite dans la Notification créée par `startConversation`/`sendMessage`, et n'est pas mappé dans la table legacy `TYPE_TO_SCREEN` — non creusé plus loin par manque de temps, documenté comme un bug réel distinct, non corrigé.

## 24. Deep-link hôtel valide

`altimmo://mes-hotels/<hotelId>` **ne routait initialement nulle part** — reproduit 2 fois de façon indépendante (l'app restait sur l'écran d'accueil). Cause exacte identifiée par lecture directe : `altimmo-app/src/navigation/navigationSdk.js`, l'objet `linking.config.screens.Main.screens.Profil.screens` ne déclarait tout simplement pas les 4 écrans hôteliers (`HotelOperations`/`HotelCockpit`/`HotelHousekeeping`/`HotelMaintenance`), alors que `shared/navigation/registry.json` les définit bien avec un `deepLink` réel. Un simple oubli d'ajout lors de l'introduction de ces écrans, jamais détecté faute de test E2E antérieur sur ce chemin précis.

## 25. Deep-link hôtel — correction

Ajout additif pur de 4 clés dans `navigationSdk.js` (`HotelOperations: pathFor('HOTEL_OPERATIONS')`, etc.), mêmes noms que les routes réellement déclarées dans `ProfilStack.jsx` (vérifié ligne par ligne avant application). Aucune autre ligne touchée.

## 26. Deep-link hôtel — E2E après correction

`openLink altimmo://mes-hotels/<hotelA>` → navigation réelle vers HotelCockpit, `Room hôtel rejointe` (Socket.IO) + `GET /api/dashboard-analytics/hotels?hotelId=<hotelA>` **200** confirmés en log, écran Cockpit affichant les vraies données d'occupation.

## 27. Deep-link étranger refusé

`openLink altimmo://mes-hotels/<hotelC>` (hôtel appartenant à `owner-b-e2e`, jamais à l'acteur courant `rental-owner-e2e`) → `GET /api/dashboard-analytics/hotels?hotelId=<hotelC>` → **403** confirmé (2 requêtes, cohérent). UI dégrade proprement (« Indicateurs indisponibles pour le moment », compteurs à zéro par défaut) — **aucune donnée réelle de l'Hôtel C n'apparaît à l'écran**.

## 28. Hotel A → B (mécanisme de bascule)

Depuis le Cockpit Hôtel A (post-correction du deep-link), `openLink altimmo://mes-hotels/<hotelB>` → séquence Socket.IO réelle et propre : `Room hôtel quittée (hotelA)` → `Room hôtel rejointe (hotelB)` → `GET dashboard-analytics?hotelId=<hotelB>` **200**, écran affichant « Occupation 0/1 » (donnée réelle et distincte de l'Hôtel A « 0/8 »). Aucune donnée périmée de l'Hôtel A affichée après bascule.

## 29. Hotel A → B via notification spécifiquement

**NON CONFIRMÉ pour le déclenchement par tap sur une notification précise.** Le mécanisme de bascule lui-même (deep-link → contexte → socket) est prouvé fonctionnel (§28). Mais les notifications de type hôtelier (ex. `maintenance_ticket_created`) n'ont pas de `destination` de registre explicite ni de mapping legacy — même famille de lacune que §23, non creusée plus avant faute de temps.

## 30. Socket reconnect — preuve réelle

Coupure réseau réelle (`adb shell svc wifi disable && svc data disable`) puis rétablissement (`svc wifi enable && svc data enable`) pendant que l'app était sur le Cockpit Hôtel B. Logs : `Déconnecté (transport close)` → `Connecté` (nouveau socketId) → **`Room hôtel rejointe (hotelB)` automatique**, sans aucune action utilisateur. Confirme que `useHotelRealtime.js`'s `socket.on('connect', rejoin)` fonctionne réellement en conditions de coupure réseau réelle (pas seulement en lecture de code).

## 31. Room rejoin

Confirmé au paragraphe précédent — rejoin automatique et correct (hôtel B, celui affiché au moment de la coupure, pas un hôtel périmé).

## 32. Duplication de listeners

Non observée : un seul événement `Room hôtel rejointe` par reconnexion, pas de doublon, pas de `GET dashboard-analytics` en rafale anormale après reconnexion (un seul refetch correct constaté).

## 33. Network loss

Coupure réseau réelle confirmée (§30) — l'application est restée affichée normalement (aucun crash, aucun écran blanc) pendant toute la durée de la coupure.

## 34. Network recovery

Après rétablissement, l'app a repris son fonctionnement normal sans action manuelle (rejoin automatique déjà noté, écran resté cohérent, aucune donnée corrompue observée).

## 35. Auth behavior pendant la perte réseau

**Confirmé correct** : la coupure réseau n'a **pas** déclenché de déconnexion/retour à l'écran de connexion (vérifié par capture d'écran immédiatement après rétablissement — toujours sur le Cockpit Hôtel B, toujours authentifié). Cohérent avec le code de `api.js` audité en amont (network error ≠ 401, jamais un logout).

## 36. Bug distinct découvert : statut HTTP incorrect sur un refus d'accès conversation

`assertConversationAccess()` (`conversationController.js`, logique pré-existante, jamais modifiée par ce sprint) lève une erreur avec `error.statusCode = 403` mais sans jamais appeler `res.status(403)` avant — le middleware d'erreur global ne reconnaît pas ce pattern spécifique et retombe sur son défaut (500). Confirmé pré-existant (`git diff` ne montre aucune modification de cette fonction). Impact : le message reste correct (« Accès refusé », aucune fuite de données), seul le code HTTP est trompeur. **Non corrigé** — hors du scope du bug Messaging tenant-scope, touche un pattern d'erreur générique qui mériterait un examen plus large avant correction.

## 37. Inspection Fail — préparation

Cycle réel via API (reservation `RES-2026-000001`) : auto-assignation → check-in → résolution financière complète (facture/paiement/allocation réels, mêmes étapes que MOB-E2E-2) → check-out → ménage (start/complete) → chambre en statut `inspection`.

## 38. Inspection Fail — exécution

`PATCH /api/inspections/:id/reject` avec des notes réelles → **200**. Résultat exactement conforme à la prédiction du code faite dans l'état initial (§13 de ce document) : `inspection.result = "failed"`.

## 39. Inspection Fail — état final chambre

Chambre A1 : `status = "out_of_service"` (confirmé via API, pas seulement supposé) — jamais `available` (contrairement au chemin Pass).

## 40. Inspection Fail — pas de ticket maintenance automatique

`GET /api/maintenance?hotelId=<hotelA>` → 0 ticket — confirme qu'aucun `MaintenanceTicket` n'est créé automatiquement par le rejet d'inspection (conforme au code lu en amont, la création reste un acte staff distinct).

## 41. Background/foreground

**NON CONFIRMÉ.** Non testé explicitement ce sprint — temps consacré en priorité à la découverte et à la correction des bugs P0 (Messaging) et P1 (deep-links hôteliers), conformément au choix de priorisation validé en cours de sprint.

## 42. Cold start

**Partiellement observé, non certifié formellement.** Une tentative de deep-link via `adb shell am start` a déclenché un cold start réel de l'app (contournant le processus déjà lancé), mais celui-ci a atterri sur le lanceur natif Expo Dev Client (même limitation que MOB-E2E-2 pour ce mécanisme précis d'invocation), pas sur l'app elle-même — ne constitue pas une preuve exploitable. `NON CONFIRMÉ`.

## 43. Push delivery

**NON CONFIRMÉ** — jamais testé, aucun mécanisme de push réel disponible dans cet environnement (cohérent avec MOB-E2E-2, non contredit ce sprint).

## 44. Incident ADB (transparence méthodologique)

`adb kill-server`/`start-server` (nécessaire pour résoudre une erreur transitoire `Can't find service: activity`, cause exacte non déterminée — possible instabilité du démon adb après une session très longue) a fait perdre les redirections de port `adb reverse`, provoquant une erreur Metro (« Failed to connect to localhost ») confondue un instant avec un bug applicatif avant diagnostic correct. Redirections rétablies explicitement (`adb reverse tcp:8081 tcp:8081`, `tcp:5057 tcp:5057`), confirmé résolu.

## 45. Sécurité — récapitulatif

Ownership : vérifié à chaque étape (Tenant Portal, Messaging après correction). Tenant : la correction Messaging ne retire jamais de contrôle de sécurité réel, seulement une frontière tenant qui ne protégeait rien pour un acteur sans tenant propre (raisonnement détaillé §12). JWT/tokenVersion : inchangé, non re-testé spécifiquement (hérité MOB-E2E-2). Hotel access : deep-link étranger correctement refusé (§27). Locataire linkage : jamais contournable par ID fourni (§18, §21).

## 46. Tests ciblés

Aucun test unitaire ciblé n'a été nécessaire pour la correction Messaging au-delà de la suite existante (`conversationRoutes.test.js`, 4/4 PASS après correction) — la correction est un ajustement de garde conditionnelle, entièrement couvert par re-test E2E réel plutôt que par de nouveaux tests unitaires (choix assumé sous contrainte de temps).

## 47. Tests serveur

`npm run test:unit` : **116/116 suites, 1331/1331 tests, 100% vert.** Deux échecs flaky observés en cours de route (`iam3CapabilityMiddleware.test.js`, `propertyRoutes.test.js`, `accommodationRoutes.test.js` — jamais le même fichier deux fois), chacun confirmé passer isolément puis la suite complète re-confirmée verte. Aucun fichier de logique métier touché par ce sprint n'est en cause (tous les fichiers modifiés ont leurs tests dédiés passants, notamment `conversationRoutes.test.js` et `housekeepingMaintenanceRoutes.test.js` — ce dernier porte la non-régression ActionLog de MOB-E2E-2, revérifiée verte).

## 48. Tests mobile

`npm run test:coverage` : **40/40 suites, 358/358 tests, 100% vert.**

## 49. Tests client

Non exécutés spécifiquement par une suite dédiée à ce sprint (aucun fichier `client/` modifié) — lint client exécuté et vert (§ gates).

## 50. Verdict final détaillé

**Conditions mandat pour `CERTIFIÉ VERT`** : Messaging principal PASS ; Tenant Portal principal PASS ; Notifications/deep-links principaux PASS ; Hotel A→B PASS ; isolation négative PASS ; Socket reconnect PASS ; network recovery PASS ; Inspection Fail PASS ; aucun P0 ; aucun P1 ; aucun P2 bloquant ; gates finales vertes.

État réel : Messaging **PASS** (après correction, re-testé réel). Tenant Portal **PASS**. Deep-link hôtel **PASS** (après correction). Hotel A→B (mécanisme) **PASS**. Isolation négative **PASS** (Messaging, Tenant Portal, deep-link étranger). Socket reconnect **PASS**. Network recovery **PASS**. Inspection Fail **PASS**. Gates finales toutes vertes.

**Mais** : deux P0/P1 ont été trouvés et corrigés en cours de sprint (pas un état de départ propre — la certification porte sur l'état *après* correction, ce qui est conforme à l'esprit du mandat, mais doit être dit explicitement). Deux bugs réels supplémentaires restent **non corrigés** : navigation de notification `message_staff` incorrecte (§23), et code HTTP 500 au lieu de 403 sur un refus d'accès conversation (§36) — tous deux classés P2/P3 (n'empêchent pas la fonction principale, mais dégradent l'expérience/observabilité). Background/foreground et cold-start restent `NON CONFIRMÉ`.

Le mandat exige explicitement qu'aucun `NON CONFIRMÉ` ne soit transformé en PASS par raisonnement, et que le rapport reflète l'état réel plutôt qu'un objectif de verdict vert. Deux items du périmètre nommé (`background/foreground`, `cold start`) n'ont pas été exécutés ; deux bugs réels identifiés restent ouverts.

**POST-E2E-1 ANDROID : GO SOUS RÉSERVES.**

Réserves précises : (1) `ConversationsScreen.jsx` doit interroger `/conversations/my-inbox` en plus de `/conversations` pour qu'un client revoie sa conversation après navigation ; (2) la résolution de navigation des notifications `message_staff`/types hôteliers doit recevoir une `destination` de registre explicite ; (3) `assertConversationAccess` doit renvoyer 403 et non 500 ; (4) background/foreground et cold-start via deep-link doivent être exécutés et prouvés dans un sprint ultérieur. Aucun de ces quatre points n'est un P0/P1 — ils ne remettent pas en cause la certification des flux principaux prouvés PASS ci-dessus, mais empêchent formellement `CERTIFIÉ VERT` selon la lettre du mandat. **iOS reste `NON CERTIFIÉ`**, jamais exécuté.

## 51. Périmètre de code touché — récapitulatif

**Bug Messaging (correction)** : `server/routes/conversationRoutes.js`, `server/routes/messageRoutes.js`, `server/controllers/conversationController.js`, `server/controllers/messageController.js`. **Bug ActionLog (hérité de MOB-E2E-2, corrigé ce sprint)** : 15 sites dans 11 contrôleurs (`typeAction: 'CREATION'` → `'CRÉATION'`), test de non-régression ajouté dans `server/__tests__/housekeepingMaintenanceRoutes.test.js`. **Bug deep-link hôtel (correction)** : `altimmo-app/src/navigation/navigationSdk.js` (4 lignes additives). **Fixtures** : `server/scripts/start-mobile-e2e.js` (Owner B/Hôtel C, Tenant B/Locataire B/Contrat B, `JWT_EXPIRES_IN` 1h→4h). **Documentation** : `server/docs/POST_E2E1_ETAT_INITIAL.md`, `server/docs/POST_E2E1_REPORT.md` (nouveaux). Aucun autre fichier de production touché.

## 52. `.env` final

Restauré aux valeurs de production exactes (mêmes valeurs que MOB-E2E-2, vérifiées par lecture finale du fichier) : `API_URL`/`EXPO_PUBLIC_API_URL`/`EXPO_PUBLIC_SOCKET_URL` → `https://altitude-vision.onrender.com`, `EXPO_PUBLIC_SENTRY_DSN` renseigné.

## 53. Processus arrêtés

Backend de test, Metro (`expo start`), tous confirmés arrêtés (ports `5057`/`8081` libres).

## 54. Dette restante (priorisée)

P2 — `ConversationsScreen.jsx` doit lister aussi les conversations `isStaffInbox:true` du client (via `/my-inbox`). P2 — Résolution de navigation des notifications hôtelières/`message_staff` incomplète. P3 — `assertConversationAccess` renvoie 500 au lieu de 403. P4 — Legacy `createOrGetConversation` (`POST /conversations`) reste bloquée par le même bug tenant-scope que `/start` avant correction — non exercée par le mobile actuel (route dépréciée), non corrigée, à retirer ou corriger si un jour réutilisée. Non exécuté — background/foreground, cold-start réel, réception Socket.IO temps réel à deux devices simultanés pour Messaging.

## 55. iOS

**NON CERTIFIÉ.** Jamais exécuté, comme tous les sprints précédents.

## 56. Git final

`git status --short` : fichiers modifiés/créés listés en détail §51, plus les fichiers hérités des sprints précédents (inchangés). `git diff --check` : `exit 0` (avertissements CRLF/LF bénins sur 2 fichiers, pas des erreurs). `git branch --show-current` : `main`. `git rev-parse HEAD` : `ab5ae586fab50ddce02e65ea081330d2769c6503` — **identique au HEAD de début de sprint**. Aucun `git add`/`commit`/`push`.

---

## Matrice de certification

| Domaine | Android runtime | Backend corroboré | Isolation testée | Verdict |
|---|---:|---:|---:|---|
| PMS nominal | acquis MOB-E2E-2 | oui | oui | CERTIFIÉ (hérité) |
| Messaging | oui | oui | oui | PASS (après correction P0) |
| Messaging realtime (2 devices) | non | — | — | NON CONFIRMÉ |
| Tenant Portal | oui | oui | oui | PASS |
| Tenant ownership | oui | oui | oui | PASS |
| Tenant maintenance | oui | oui | oui | PASS |
| Notifications in-app (affichage/lu) | oui | oui | n/a | PASS |
| Notifications in-app (navigation exacte) | oui | oui | n/a | FAIL (bug réel, non corrigé) |
| Deep-link hôtel | oui | oui | n/a | PASS (après correction P1) |
| Hotel A → B (mécanisme) | oui | oui | oui | PASS |
| Hotel A → B (via tap notification) | non | — | — | NON CONFIRMÉ |
| Foreign deep-link | oui | oui | oui | PASS |
| Background/foreground | non | — | — | NON CONFIRMÉ |
| Cold start | non | — | — | NON CONFIRMÉ |
| Socket reconnect | oui | oui | n/a | PASS |
| Network loss/recovery | oui | oui | n/a | PASS |
| Inspection Fail | oui | oui | n/a | PASS |
| ActionLog inspection (hérité MOB-E2E-2) | oui | oui | n/a | PASS (corrigé, testé) |

---

## Q&A factuelles (34 questions obligatoires)

1. **Messaging fonctionne-t-il réellement sur Android ?** Oui, après correction du bug tenant-scope (P0).
2. **Le message est-il persisté côté backend ?** Oui, vérifié via API après envoi.
3. **La réception realtime est-elle certifiée ?** Non testée à deux devices simultanés — `NON CONFIRMÉ`.
4. **Un tiers peut-il ouvrir une conversation étrangère ?** Non, refusé (mais code HTTP 500 au lieu de 403, bug distinct non corrigé).
5. **Tenant Portal fonctionne-t-il réellement ?** Oui, toutes les données réelles et cohérentes.
6. **Le rattachement User → Locataire → Contrat est-il respecté ?** Oui, jamais contournable par ID fourni.
7. **Un locataire peut-il lire les documents d'un autre ?** Non, isolation structurelle confirmée.
8. **La maintenance locataire fonctionne-t-elle ?** Oui, `POST` 201 réel, ticket visible immédiatement.
9. **Une notification in-app réelle ouvre-t-elle le bon écran ?** Non — bug réel identifié, navigation atterrit sur la liste générique vide, pas la conversation.
10. **Hotel A → notification Hotel B bascule-t-il correctement le contexte ?** Le mécanisme de bascule (deep-link) est prouvé ; le déclenchement spécifique par tap sur une notification hôtelière n'a pas été testé (même famille de lacune que Q9).
11. **La socket quitte-t-elle réellement A pour B ?** Oui, confirmé par logs (`quittée`/`rejointe`).
12. **Un deep-link étranger est-il refusé ?** Oui, 403 réel confirmé, aucune donnée exposée.
13. **Background → foreground fonctionne-t-il ?** Non testé — `NON CONFIRMÉ`.
14. **Cold start deep-link fonctionne-t-il ?** Non concluant (a atterri sur le lanceur Dev Client) — `NON CONFIRMÉ`.
15. **Push cold-start a-t-il réellement été testé ?** Non — `NON CONFIRMÉ`.
16. **Socket reconnect fonctionne-t-il ?** Oui, prouvé par coupure réseau réelle.
17. **La room hôtel est-elle rejointe ?** Oui, automatiquement après reconnexion, sans action utilisateur.
18. **Existe-t-il des listeners dupliqués après reconnect ?** Non observé.
19. **Une coupure réseau provoque-t-elle un logout incorrect ?** Non, confirmé correct.
20. **L'application récupère-t-elle après retour réseau ?** Oui, automatiquement.
21. **Inspection Fail fonctionne-t-il ?** Oui, résultat exactement conforme au code.
22. **Quel est l'état final réel de la chambre après Inspection Fail ?** `out_of_service`, confirmé via API.
23. **Le P3 ActionLog (hérité MOB-E2E-2) est-il reproductible ?** Oui, il l'était (15 sites, pas seulement 1).
24. **Quelle en est la cause exacte ?** Littéral non accentué `'CREATION'` vs enum `'CRÉATION'`.
25. **Est-il corrigé ?** Oui, aux 15 sites, avec test de non-régression.
26. **Existe-t-il un P0 ouvert ?** Non — le seul P0 trouvé (Messaging tenant-scope) est corrigé.
27. **Un P1 ?** Non — le seul P1 trouvé (deep-link hôtel) est corrigé.
28. **Un P2 bloquant ?** Deux P2 réels restent ouverts (navigation notification, liste conversations client) mais ne bloquent pas la fonction principale déjà prouvée PASS — non « bloquants » au sens strict, mais empêchent `CERTIFIÉ VERT` par la lettre du mandat.
29. **Les tests serveur sont-ils verts ?** Oui, 1331/1331.
30. **Les tests mobile sont-ils verts ?** Oui, 358/358.
31. **Expo Doctor reste-t-il 21/21 ?** Oui.
32. **Android export reste-t-il vert ?** Oui.
33. **`.env` a-t-il été restauré ?** Oui, valeurs de production exactes vérifiées.
34. **iOS a-t-il réellement été exécuté ?** Non, `NON CERTIFIÉ`, jamais inféré.
