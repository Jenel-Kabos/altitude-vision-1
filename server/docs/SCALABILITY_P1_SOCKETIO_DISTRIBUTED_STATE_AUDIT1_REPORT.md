# SCALABILITY-P1-SOCKETIO-DISTRIBUTED-STATE-AUDIT-1 — Rapport

## Executive summary

**SOCKET.IO DISTRIBUTED READINESS SCORE : 54 / 100.**

**Verdict : B — MULTI-INSTANCE MOSTLY SAFE WITH DURABLE FALLBACK.**

| Indicateur | Résultat |
|---|---|
| 1 instance | **SAFE** — auth, tenant isolation et rooms rigoureusement testés (Mongo réel, multi-clients) |
| 2 instances | **CONDITIONAL** — aucune perte de donnée démontrée, mais la livraison temps réel cross-instance échoue silencieusement pour tout événement dont l'émetteur et le destinataire ne partagent pas le même processus |
| 10 instances | **CONDITIONAL** — même mécanisme, amplifié : la probabilité qu'émetteur et destinataire soient sur des instances différentes croît avec le nombre d'instances |
| P0 | **0** — aucune fuite cross-tenant démontrée ; au contraire, activement prouvée absente par des tests d'intégration Mongo réels |
| P1 | **2** |
| P2 | **4** |
| P3 | **1** |
| Current adapter | **Aucun — adaptateur en mémoire par défaut de Socket.IO** (`new Server(httpServer, {cors, transports})`, aucune option `adapter`) |
| Presence storage | `Map` process-local (`onlineUsers` dans `server/socket.js`), clé `userId`, valeur = compteur de sockets actifs |
| Durable fallback | **Oui, systématique** — chaque message et chaque notification est persisté en base **avant** toute émission Socket.IO ; polling web (3 s messagerie, 30-60 s cloche/badges) et polling mobile conditionnel (si socket déconnecté, 30 s) complètent la récupération |
| Most serious risk | Un utilisateur multi-appareils dont les sockets sont répartis sur deux instances différentes peut, dans une fenêtre précise, ne recevoir NI l'événement socket NI la notification push de repli sur l'appareil connecté à l'instance qui n'a pas traité l'événement — seul le polling applicatif le rattrape |
| Recommended phase 1 | Adaptateur Socket.IO distribué (Redis) pour la livraison temps réel + présence agrégée cross-instance ; aucune migration de la persistance (déjà durable) |
| Redis required now | **CONDITIONAL** — pas pour éviter une perte de données (déjà couverte par la persistance + le polling), mais nécessaire pour restaurer une expérience temps réel correcte dès que le trafic est réparti sur plusieurs instances |

Ce mandat ne rouvre pas Distributed Jobs (Phase 1 certifiée GREEN, score 74/100, non retouchée). Il traite exclusivement Socket.IO/presence/rooms/messagerie temps réel, en lecture seule stricte.

## 0. Baseline (§3 du mandat)

- Branche `main`. HEAD : `f56774e317680aca1bb3992d8d03c0623215f451`, inchangé pendant tout ce mandat.
- `git status --short` : worktree identique à l'état laissé par le mandat Distributed Jobs Hardening précédent (8 fichiers suivis modifiés + 10 fichiers nouveaux + 3 rapports non suivis) — **rien n'a été ajouté, modifié ou supprimé par ce mandat**.
- `git diff --check` : vert, inchangé.
- Aucune commande destructive exécutée. Aucun Redis lancé. Aucune dépendance installée.

## 1. Constats extraits des trois rapports de référence

- `PLATFORM_HEALTH_AUDIT_360_V1_REPORT.md` : « la présence Socket.IO repose sur une `Map` en mémoire et aucun adaptateur Redis/distribué n'a été trouvé. Plusieurs instances n'auront pas une vue commune des connexions et rooms » ; classé **R2, sévérité Haute, impact Élevé, P1** ; cité comme un des deux premiers points de rupture probable à 10× (avec les jobs planifiés, désormais traités).
- `SCALABILITY_P1_DISTRIBUTED_JOBS_AUDIT1_REPORT.md` : confirme qu'aucune dépendance Redis n'existe dans le runtime serveur ; les jobs traitent les notifications Socket comme fire-and-forget, la persistance DB (`Notification`) restant la source de vérité.
- `SCALABILITY_P1_DISTRIBUTED_JOBS_HARDENING1_REPORT.md` : confirme que le hotfix Distributed Jobs n'a touché ni Socket.IO, ni Redis, ni aucune dépendance — le périmètre de ce mandat est donc entièrement disjoint et non affecté.

## 2. Inventaire Socket.IO (§5-§7)

**Fichier central unique : `server/socket.js` (258 lignes).** C'est le seul fichier qui initialise `new Server(...)`, définit le store de présence, les rooms et les listeners de connexion.

| Fichier | Rôle |
|---|---|
| `server.js` | Crée le serveur HTTP, appelle `initSocket(httpServer)` |
| `socket.js` | Singleton `_io`, auth, presence, rooms user/hotel/conversation, `emitHotelEvent` |
| `controllers/conversationController.js` | Émet `new-message`/`new-staff-message` après persistance `Message.create` |
| `controllers/messageController.js` | Idem, chemin alternatif |
| `services/notificationService.js` | `notify()`/`notifyStaff()` — persistance + émission room utilisateur + fallback push |
| `services/hotelReservationExpiryService.js`, `checkInService.js`, `checkOutService.js`, `housekeepingService.js`, `maintenanceService.js`, `inspectionService.js`, `hotelReservationService.js` | Appellent `emitHotelEvent(hotelId, payload)` après leurs écritures métier |

Aucun autre fichier n'initialise de serveur Socket.IO, n'importe `socket.io-adapter`, ni ne définit de store de présence concurrent.

## 3. Entrypoint (§6)

```
server.js
  → const server = http.createServer(app)
  → initSocket(server, corsOptions)      [server/socket.js]
      → new Server(httpServer, { cors, transports:['websocket','polling'] })
      → io.use(authMiddleware)            [JWT + tokenVersion + status + tenant context]
      → io.on('connection', socket => {
          onlineUsers.set(...)            [presence, incrément]
          socket.join(socket.userId)      [room utilisateur]
          socket.on('establishment:join') [room hôtel, autorisation vérifiée]
          socket.on('establishment:leave')
          socket.on('join-room')          [room conversation, autorisation vérifiée]
          socket.on('leave-room')
          socket.on('typing')
          socket.on('disconnect')         [presence, décrément]
        })
```

## 4. Stores en mémoire (§8)

| Store | Fichier | Type | Contenu | Persisté ? | Distribué ? | Risque multi-instance |
|---|---|---|---|---|---|---|
| `onlineUsers` | `socket.js:13` | `Map<string, number>` | `userId → nombre de sockets actifs sur CE processus` | Non | **Non** | Sous-évaluation possible du nombre réel de sockets d'un utilisateur si ses sockets sont répartis sur plusieurs instances (§16) |
| `_io` (singleton) | `socket.js:10` | Variable de module | Instance Socket.IO du processus courant | Non | **Non**, par construction (chaque processus a la sienne) | N/A — c'est l'attendu ; le risque est l'absence d'adaptateur partagé entre ces instances, pas le singleton lui-même |
| Adaptateur de rooms (`_io.sockets.adapter.rooms`) | Interne à `socket.io` | `Map` (implémentation par défaut) | Sockets par room, **process-local** | Non | **Non** | Base du problème central de ce rapport — voir §17-§21 |

Aucun autre store process-local dédié au temps réel n'a été trouvé (pas de cache de conversations, pas de compteur de non-lus en mémoire côté serveur — ces compteurs sont recalculés depuis MongoDB à chaque requête, voir `services/unreadCountService`/équivalent appelé par le client).

## 5. Auth Socket.IO (§9)

Middleware `_io.use(...)` dans `socket.js` :
- JWT vérifié (`jwt.verify(token, process.env.JWT_SECRET)`), même secret que `authMiddleware.protect`.
- `tokenVersion` comparé à `user.tokenVersion` — révocation globale immédiate, cohérente avec le contrat HTTP.
- Statut `Suspendu`/`Banni`/`isActive` vérifié — refus de connexion.
- Contexte tenant résolu via `resolveEffectiveTenantContext(user._id, requestedTenantId)` (`services/platformTenant/tenantContextService.js`) — **jamais un `platformTenantId` brut du client accepté tel quel** : la fonction vérifie l'appartenance réelle (`OrgMembership`) avant de retenir un tenant actif. Un tenant non résolu → connexion refusée (`Contexte tenant requis`).

**Ce contrat est identique en rigueur à l'authentification HTTP.** Aucune ré-audition horizontale de sécurité n'a été faite (hors scope) — seule la présence et la cohérence du contrat ont été confirmées.

## 6. Rooms — contrats vérifiés (§10-§13)

| Room | Pattern | Qui rejoint | Source de l'ID | Vérification |
|---|---|---|---|---|
| **User** | `socket.userId` (le userId lui-même comme nom de room) | Automatique à la connexion | `socket.userId`, dérivé du JWT décodé côté serveur | Jamais depuis un payload client — dérivé exclusivement de l'auth |
| **Tenant** | **N'existe pas.** Aucune room `tenant:<id>` n'a été trouvée dans tout le code. | — | — | La diffusion « tenant-wide » (`notifyStaff`) est un **fan-out applicatif** : résolution DB du scope staff du tenant (`resolveTenantScope`), puis un appel `notify()` individuel par membre — chacun repasse par la room utilisateur, pas par une room partagée. Conséquence directe : chaque destinataire staff est protégé **individuellement** par la persistance + le fallback push, comme n'importe quel utilisateur seul (§16), ce qui limite le rayon d'impact d'un problème multi-instance à un destinataire à la fois plutôt qu'à tout un tenant d'un coup. |
| **Hotel** | `` `hotel:${hotelId}` `` | Sur `establishment:join`, après re-vérification complète (session fraîche + `assertOperationalHotelAccess`) | `id` du payload client, mais **jamais fait confiance sans vérification** — l'autorité réelle est revérifiée à chaque `emitHotelEvent` (auto-nettoyage des membres révoqués/plus autorisés, déconnexion forcée si session invalide) | Testé réellement (voir §12) |
| **Conversation** | `` `conv:${conversationId}` `` | Sur `join-room`, après `canAccessConversation` | `conversationId` du payload client, vérifié contre `Conversation.participants`/`isStaffInbox` | Le contrat métier autorise intentionnellement le staff same-tenant à lire la boîte partagée — **confirmé conforme, pas une vulnérabilité** (mandat §13/§27) |

## 7. Présence (§14-§16)

`onlineUsers` incrémente/décrémente un compteur par `userId`, strictement local au processus. `isUserOnline(userId) = onlineUsers.has(userId)`.

- **Multi-onglet/multi-device sur UNE instance** (§15) : correctement géré — le compteur descend à 0 seulement quand le dernier socket local se déconnecte ; tant qu'un autre onglet/device reste connecté sur la même instance, l'utilisateur reste "online" pour cette instance.
- **Multi-instance (§16)** : **CONDITIONAL, démontré par lecture directe du code, pas supposé.** Si l'utilisateur U a un socket sur l'instance A et un socket sur l'instance B, chaque instance ne connaît que SON PROPRE socket de U. Si le socket de A se déconnecte, le compteur local de A tombe à 0 et `isUserOnline(U)` sur A devient `false` — **alors que U est toujours réellement connecté via B.** Cela ne peut jamais produire un faux positif (déclarer online alors que personne n'est connecté nulle part), seulement un faux négatif localisé à une instance qui n'a plus le socket concerné.

## 8. Scénarios de propagation cross-instance (§17-§21, §47-§51)

Chaque scénario a été tranché par lecture directe du code (pas de test à 2 serveurs disponible pour une preuve runtime — voir §11 du présent rapport), en s'appuyant sur le fait démontré que l'adaptateur par défaut de Socket.IO est strictement process-local (`_io.sockets.adapter.rooms` n'existe que dans la mémoire du processus courant, aucun `createAdapter`/pub-sub n'a été trouvé nulle part dans le code, confirmé §35-§36).

| Scénario | Résultat | Preuve |
|---|---|---|
| **User A→B, cross-instance** (`getIO().to(userId).emit(...)`) | **NON** — l'émission sur l'instance de A n'atteint que les sockets connus de CETTE instance ; si le socket de B vit sur une autre instance, l'émission est un no-op silencieux (aucune erreur, aucun log d'échec) | Lecture directe de `socket.js`/`notificationService.js` : aucun mécanisme de propagation inter-processus n'existe |
| **Tenant broadcast, cross-instance** | **Sans objet au sens room** (aucune room tenant n'existe, §6) — mais le fan-out `notifyStaff` appelle `notify()` individuellement pour chaque staff, donc chaque destinataire suit exactement le cas "User A→B" ci-dessus, avec son propre repli push/polling indépendant | `notificationService.js::notifyStaff` |
| **Hotel broadcast, cross-instance** | **NON** — `emitHotelEvent` itère `_io.sockets.adapter.rooms.get(room)`, qui ne contient que les sockets locaux au processus qui exécute cette fonction | `socket.js::emitHotelEvent` |
| **Conversation broadcast, cross-instance** | **NON**, même mécanisme (`getIO().to(recipientId ou room).emit(...)`) | `conversationController.js`, `messageController.js` |
| **Direct socketId, cross-instance** | **NON** — si un `socketId` appartient à une autre instance, `_io.sockets.sockets.get(socketId)` renvoie `undefined` sur l'instance courante ; aucune émission ne part (pas d'erreur non plus) | Comportement standard de l'adaptateur en mémoire, confirmé par l'absence totale d'adaptateur partagé |

## 9. Scénarios narratifs demandés (§47-§51)

- **Scénario A** (client instance A envoie un message, staff instance B) : `Message.create()` réussit toujours (DB indépendante des instances). `getIO().to(staffId).emit('new-staff-message', ...)` sur A échoue silencieusement à atteindre B. `notifyStaff(...)` s'exécute en parallèle : pour CE staff précis, si son unique socket est sur B, `isUserOnline` sur A retourne `false` → tentative de push (mobile) — sans effet si le staff est web-only sans `pushToken`. **Récupération garantie par le polling** : web `ChatWindow.jsx` republie l'écran toutes les 3 s ; mobile `ConversationsScreen.jsx`/`ChatScreen.jsx` republient toutes les 30 s **si leur propre socket est considéré déconnecté** (ce qui n'est PAS le cas ici, puisque le socket du staff sur B est parfaitement valide de son propre point de vue) — dans ce sous-cas mobile précis, la récupération dépend alors du polling de la cloche de notification (30-60 s) ou d'une réouverture manuelle de la conversation, pas du polling de fallback du chat lui-même.
- **Scénario B** (2 staff même tenant, S1 sur A, S2 sur B, événement "tenant" émis sur A) : comme il n'existe pas de room tenant, cette diffusion est en réalité un fan-out `notify()` par destinataire (§6). S2 reçoit son propre `notify()` individuellement traité — le résultat dépend uniquement de savoir sur quelle instance CE `notify()` particulier pour S2 s'exécute, pas d'un unique broadcast partagé.
- **Scénario C** (même user, Web instance A, Mobile instance B, disconnect A) : la présence finale vue par A devient incorrecte (A ne voit plus U comme "online" alors que B a toujours son socket), mais aucune autre instance ne s'appuie sur l'état local de A pour son propre traitement — donc cette incohérence de présence n'a d'effet visible que sur les décisions **prises par A elle-même** (ex. décision d'envoyer un push si un événement pour U est traité par A après ce moment).
- **Scénario D** (hotel staff A/B sur deux instances, nouvelle réservation événement émis sur A) : B ne reçoit **pas** l'événement temps réel (§8). B découvre la nouvelle réservation via son prochain rechargement/navigation de l'écran concerné — **aucun polling dédié aux écrans hôtel n'a été trouvé** (contrairement à la messagerie/notifications) ; recherché explicitement dans `client/lib`/`altimmo-app/src`, aucun `setInterval` propre aux écrans hôtel (housekeeping/maintenance/réservations) n'existe. C'est un **P2** (dégradation UX, pas perte de donnée — la réservation existe bien en base et apparaîtra au prochain chargement), pas un P1, car aucune action automatique critique ne dépend de cette fraîcheur temps réel dans le code audité.
- **Scénario E** (notification persistée, socket perdu — délai de récupération) : cloche web (`useNotifications.js`) = jusqu'à 30 s ; badges dashboard (`useDashboardBadges.js`) = jusqu'à 60 s ; chat web = jusqu'à 3 s ; chat mobile = jusqu'à 30 s **si son propre socket est mort**, sinon dépend de la cloche mobile ou d'une réouverture manuelle.

## 10. Messagerie — durabilité (§25-§27)

- `Message.create(...)` est **toujours exécuté avant** toute émission Socket.IO — confirmé dans `conversationController.js` et `messageController.js`.
- L'émission brute (`new-message`/`new-staff-message`) est *best-effort*, encapsulée dans `try/catch` vide — un échec est silencieusement ignoré, sans jamais faire échouer la requête HTTP qui a créé le message.
- Le `notify()` parallèle (pour le message staff) porte sa propre persistance (`Notification.create`) et son propre fallback push, indépendamment de la réussite de l'émission `new-message`.
- **Réponse à la question centrale du mandat §26** : la DB reçoit toujours le message (oui, inconditionnellement). Le staff le voit immédiatement **si et seulement si** son socket actif est sur la même instance que celle qui traite l'envoi. Sinon, il le voit au prochain cycle de polling (≤ 3 s web, ≤ 30 s mobile si son propre socket est jugé mort, sinon au prochain rafraîchissement de la cloche ou de la conversation).

## 11. Tests existants (§41-§43, §46)

| Fichier | Portée | Serveurs Socket.IO réels démarrés |
|---|---|---|
| `__tests__/socketTenantIsolation.mongo.integration.test.js` | Isolation tenant/hôtel/conversation, multi-clients, Mongo réel | **1 seul** (`http.createServer()` + `initSocket()` une fois) |
| `__tests__/socketAuthorization.test.js` | Auth JWT/tokenVersion/statut | **1 seul** |

**Aucun test ne démarre réellement deux serveurs Socket.IO (deux processus ou deux instances `initSocket` avec adaptateur partagé)** — confirmé par lecture complète des deux fichiers, pas supposé. Les tests existants sont rigoureux et concluants pour la sécurité/isolation **intra-instance**, mais ne peuvent, par construction, rien prouver sur la propagation **inter-instance** — c'est cohérent avec l'absence d'adaptateur distribué : il n'y a rien à tester de plus tant qu'aucun adaptateur n'existe.

**Ce mandat ne crée aucun test** (read-only), conformément à l'interdiction explicite (§43 du mandat).

## 12. Sécurité et tenant scoping (§44, §66)

| Room type | Autorité (source) | Client contrôle l'ID ? | Tenant safe ? |
|---|---|---|---|
| User | JWT décodé serveur (`socket.userId`) | Non | Oui, par construction (l'ID n'est jamais un ID arbitraire soumis par le client) |
| Hotel | `assertOperationalHotelAccess` réévalué à chaque join ET à chaque broadcast | Le client propose un `id`, mais n'a aucune autorité dessus | Oui — prouvé par test réel (owner A ne peut ni rejoindre ni recevoir les événements de l'hôtel B, même même tenant) |
| Conversation | `canAccessConversation` (participants + `isStaffInbox`+ tenant actif) | Le client propose un `conversationId`, sans autorité | Oui — prouvé par test réel (staff tenant A ne peut ni rejoindre ni recevoir un `typing` d'une conversation tenant B, même en connaissant l'ObjectId) |

**Aucune fuite cross-tenant démontrée.** Le mandat interdit d'inventer un P0 sans preuve — aucun n'est inventé ici : les tests existants démontrent activement l'inverse.

## 13. Adaptateur, singleton, event emitters (§35-§40)

- **§35-36 — Adaptateur** : recherche exhaustive de `@socket.io/redis-adapter`, `createAdapter`, `redis`, `pubClient`, `subClient`, `socket.io-adapter`, `cluster-adapter`, `postgres-adapter`, `mongo-adapter` dans tout `server/` — **zéro résultat**. `new Server(httpServer, {cors, transports})` ne configure aucune option `adapter` → Socket.IO utilise son **adaptateur en mémoire par défaut**, confirmé par absence de toute alternative.
- **§37 — Singleton** : `let _io = null` au niveau module, exposé via `getIO()` (lève une erreur explicite si appelé avant `initSocket()`) — process-local par nature, import-safe (un seul appel `initSocket` dans `server.js`), test-safe (les tests d'intégration appellent `initSocket()` sur leur propre serveur HTTP éphémère, sans collision).
- **§38 — Matrice des émetteurs hors handlers Socket** :

| Service | Event | Room | Durable DB avant emit ? | Cross-instance safe ? |
|---|---|---|---|---|
| `notificationService.notify` | `notification`, `visite:*`, `rental:*` | User (`id`) | **Oui** (`Notification.create` avant emit) | Non (voir §8) — mais fallback push/polling |
| `conversationController`/`messageController` | `new-message`, `new-staff-message` | User (`id`) | **Oui** (`Message.create` avant emit) | Non — mais polling 3 s web / 30 s mobile |
| `hotelReservationExpiryService` et les autres services hôtel | `hospitality:updated` | Hotel (`hotel:<id>`) | **Oui** (l'entité métier — réservation/tâche/ticket — est déjà persistée avant l'appel `emitHotelEvent`, confirmé dans le hotfix Distributed Jobs pour l'expiration hôtel : emit après commit de transaction) | Non — aucun polling dédié trouvé (§9 Scénario D), P2 |

## 14. Inventaire des événements (§39) et écoute client (§40)

| Événement | Émis par | Écouté par |
|---|---|---|
| `notification` | `notificationService.notify` | Web (`useNotifications.js`), a priori mobile (non vérifié en détail, hors scope strict de ce mandat centré serveur) |
| `visite:created`/`confirmed`/`cancelled`/`status_changed`, `visite:updated` | `notificationService.notify` | Écrans visites (web/mobile) |
| `rental:publication_changed`, `rental:maintenance_changed`, `rental:contract_alert`, `rental:payment_alert`, `rental:inspection_required`, `rental:occupancy_changed`, `rental:updated` | `notificationService.notify` | Écrans gestion locative (web) |
| `new-message` | `conversationController`, `messageController` | Web `ChatWindow.jsx`, mobile `ChatScreen.jsx`/`ConversationsScreen.jsx` |
| `new-staff-message` | idem | Web `StaffInboxPage.jsx`, mobile (staff) |
| `typing` | `socket.js` (relais direct) | Fenêtres de conversation |
| `hospitality:updated` | `socket.js::emitHotelEvent` | `useHotelRealtime.js` (web) |

## 15. Reconnect, sticky sessions (§32-§34)

- **Web** (`useHotelRealtime.js`) : `socket.on('connect', join)` — rejoint la room hôtel à **chaque** (re)connexion, y compris après une coupure réseau. Bon pattern, car Socket.IO ne restaure jamais automatiquement les rooms après une reconnexion.
- **Mobile** (`ChatScreen.jsx`, `ConversationsScreen.jsx`) : rejoint la conversation après connexion, avec fallback de polling conditionnel si le socket est détecté déconnecté.
- **Sticky sessions** : recherche de `render.yaml`, `Procfile`, ou toute configuration d'affinité de session — **aucun fichier trouvé**. **NON CONFIRMÉ** que des sticky sessions sont configurées en production Render — cet environnement n'a pas d'accès au tableau de bord Render (limitation déjà documentée dans les mandats précédents de cette session).
- **§56 — limite fondamentale des sticky sessions, même si configurées** : une sticky session garantirait qu'un client donné reste connecté à la même instance entre deux requêtes HTTP, mais elle ne change **rien** à un socket déjà établi en WebSocket — et surtout, elle ne permettrait jamais à l'instance A de diffuser dans une room dont les membres sont uniquement connus de l'instance B. Les sticky sessions résolvent un problème de routage HTTP, pas un problème de partage d'état entre adaptateurs Socket.IO. **Confirmé par la lecture du code : rien dans `socket.js` ne suppose ou ne compense une topologie sticky.**

## 16. Observabilité (§52-§54)

- Logs présents : connexion (`[Socket] Connecté`, avec `socketId`, `userId`, `transport`, `activeSocketsForUser` — ce dernier étant un compte **local**), déconnexion (`[Socket] Déconnecté`, avec `reason`, `remainingSocketsForUser` **local**), upgrade de transport, join/leave de room hôtel.
- **Aucun identifiant d'instance/process n'apparaît dans aucun log** — confirmé par lecture complète de `socket.js`. Dette directe pour le diagnostic multi-instance (impossible de savoir depuis les logs seuls sur quelle instance un socket donné vit).
- **Aucune métrique** (nombre de sockets connectés, nombre de rooms, événements émis/perdus, reconnexions) n'a été trouvée — ni Prometheus, ni APM, cohérent avec le constat déjà fait pour les jobs distribués.

## 17. Distinction critique (backpressure, payloads, ordering, duplicates) (§62-§65)

- **Payloads** : tous les payloads observés (`notification`, `new-message`, `hospitality:updated`, `visite:*`, `rental:*`) sont de petits objets JSON (IDs, titres, courts extraits de texte tronqués à 100 caractères pour les aperçus de message) — **aucune pièce jointe, image base64 ou HTML complet n'est jamais envoyé via Socket.IO**. Classé **LOW** en fréquence et taille.
- **Ordering** : la DB (MongoDB, horodatage `createdAt`) reste la source canonique de l'ordre des messages/notifications — les clients rechargent l'état depuis l'API en cas de doute (polling), donc un désordre d'arrivée d'événements Socket entre deux instances n'affecte que l'UX temps réel, jamais l'ordre affiché après un rechargement.
- **Duplication** : un futur adaptateur distribué pourrait exposer des doublons d'événements si l'application émettait plusieurs fois pour un même effet — non observé aujourd'hui en mono-instance ; les clients web/mobile actuels ne semblent pas dédupliquer explicitement par ID d'événement (non vérifié exhaustivement, hors scope strict serveur de ce mandat) — **à valider explicitement dans un futur hotfix avant d'introduire un adaptateur distribué**, car les tests RED proposés (§Plan futur) devront le couvrir.

## 18. Matrice multi-instance (§46)

| Fonction | 1 instance | 2 instances | 10 instances | Durable fallback | Severity |
|---|---|---|---|---|---|
| Presence | Safe | Sous-évaluation possible si sockets répartis | Idem, amplifié | Aucun (advisory only) | **P1** |
| User event | Safe | Livraison ratée si cross-instance | Idem, plus probable | Notification DB + push/polling | **P1** |
| Tenant event (fan-out) | Safe | Chaque destinataire suit le cas "user event" individuellement | Idem | Identique au cas user | P1 (hérité) |
| Hotel event | Safe (prouvé par test) | Livraison ratée si cross-instance | Idem | Aucun polling dédié trouvé | **P2** |
| Conversation message | Safe (prouvé par test) | Livraison ratée si cross-instance | Idem | Polling 3 s web / 30 s mobile conditionnel | P2 (bien couvert) |
| Notification bell | Safe | Ratée en direct si cross-instance | Idem | Polling 30-60 s | P2 (bien couvert) |
| Staff inbox realtime | Safe | Ratée en direct si cross-instance | Idem | Polling web (`InternalMessagingPage.jsx`) | P2 |
| Reconnect | Safe | Rejoin de room correct côté client (web hôtel) après reconnexion | Idem | N/A | P3 (observabilité seulement) |

## 19. Sévérités — synthèse (§45)

- **P0 (0)** : aucune fuite cross-tenant démontrée.
- **P1 (2)** :
  1. Livraison temps réel cross-instance non fonctionnelle pour tout événement (user/tenant-fanout/hotel/conversation/direct socketId) — confirmé par lecture directe de l'absence d'adaptateur.
  2. Présence multi-instance incorrecte (sous-évaluation), pouvant supprimer à tort un envoi de push de repli dans un cas précis (utilisateur multi-appareils réparti sur plusieurs instances, événement traité par l'instance qui détient déjà un de ses sockets).
- **P2 (4)** : absence de polling dédié pour les écrans hôtel temps réel ; absence de métriques Socket ; absence d'identifiant d'instance dans les logs ; absence de tout test à deux serveurs réels.
- **P3 (1)** : granularité des logs de présence (comptes locaux non étiquetés comme tels, ce qui peut induire en erreur un lecteur de logs non averti).

## 20. Nécessité de Redis — comparaison des options (§55-§59)

| Option | Description | Adéquation |
|---|---|---|
| A. Sticky sessions seules | Affinité HTTP par instance | **Insuffisant seul** — ne résout pas le partage d'état room-to-room entre instances (§56) |
| B. Socket.IO Redis adapter | Pub/sub Redis entre instances Socket.IO | **Candidat principal** — résout directement §17-§21 |
| C. Socket.IO cluster adapter | Alternative sans Redis, réservée à un cluster Node natif (`cluster` module), pas au déploiement multi-instance/multi-conteneur typique de Render | Non pertinent ici (Render déploie des instances séparées, pas un cluster Node partagé) |
| D. DB durable + polling pour certains événements | Déjà en place aujourd'hui, de facto | **Déjà le filet de sécurité actuel** — explique pourquoi le score n'est pas catastrophique malgré l'absence d'adaptateur |
| E. Hybride | Adaptateur Redis pour le temps réel + persistance/polling conservés comme filet | **Recommandation** |

**Présence cible (§59)** : Option B (Socket.IO `fetchSockets()`/état d'adaptateur distribué via Redis) plutôt qu'un compteur Redis maison — Socket.IO expose déjà les primitives nécessaires une fois l'adaptateur Redis branché, sans réinventer un mécanisme parallèle.

**Mode de défaillance Redis (§60)**, si adopté : Redis down → l'adaptateur Socket.IO se dégraderait a minima à un comportement équivalent à l'actuel (chaque instance isolée, exactement le mode présent aujourd'hui) — **pas un fail closed dangereux, un simple retour à l'état déjà connu et déjà couvert par la persistance/polling**. Les connexions Socket.IO elles-mêmes ne dépendent pas de Redis pour fonctionner en intra-instance ; seule la diffusion cross-instance serait perdue temporairement, avec le même filet de sécurité durable qu'aujourd'hui.

**Un futur Redis ne doit pas être une justification pour ajouter BullMQ maintenant** (§58) — ce mandat ne recommande rien de tel ; Distributed Jobs Phase 1 reste sur Mongo lease, certifié GREEN, non concerné.

## 21. Contrat de livraison par type d'événement (§61, §24)

| Type | Contrat souhaité réel (déduit du code) | Classification actuelle |
|---|---|---|
| Message | At-least-once durable (DB), best-effort realtime | **B — durable mais retardée en cas de miss cross-instance** |
| Notification | At-least-once durable (DB) + push best-effort + polling | **B** |
| Presence | Advisory only (jamais utilisée pour une décision métier critique autre que le choix push/pas-push) | **C — non durable mais non critique**, avec l'exception P1 documentée en §7/§18 |
| Réservation (hôtel/immobilier) | At-least-once durable (DB, déjà transactionnelle pour l'hôtel depuis le hotfix Distributed Jobs) + best-effort realtime | **B** |
| Événement hôtel générique (housekeeping/maintenance) | Durable (entité déjà persistée), realtime best-effort sans polling de repli dédié | **B, mais avec un maillon de repli plus faible (P2)** que messagerie/notifications |

## 22. Plan de futur hotfix (§77, sans implémentation)

**BLOCK A — Adaptateur Socket.IO distribué.** Introduire `@socket.io/redis-adapter` (ou équivalent), provisionné en tant que service Redis dédié (potentiellement partagé plus tard avec une éventuelle queue, sans que cela justifie son ajout aujourd'hui). Aucun changement de contrat d'événement, seulement le transport devient partagé entre instances.

**BLOCK B — Contrats presence/rooms/livraison.** Remplacer `onlineUsers` local par une présence agrégée (ex. `fetchSockets()` via l'adaptateur distribué, ou un compteur Redis avec TTL/heartbeat comme pour les leases Mongo des jobs) ; documenter/officialiser le contrat de livraison par type d'événement (tableau §21) ; ajouter un polling de repli minimal pour les écrans hôtel temps réel (P2 identifié en §9/§18), à l'image de ce qui existe déjà pour messagerie/notifications.

**BLOCK C — Tests multi-serveurs + observabilité.** Tests RED du futur hotfix (§68, proposés ci-dessous) ; ajout d'un identifiant d'instance dans tous les logs Socket ; métriques de connexions/rooms/événements émis-reçus-perdus par instance.

### Tests RED proposés pour le futur hotfix (non créés dans ce mandat)

1. Deux serveurs Socket.IO réels (deux `http.createServer()`/`initSocket()` distincts) partageant un adaptateur Redis.
2. User connecté sur le serveur A reçoit un `emit` déclenché depuis le serveur B.
3. Room tenant (si introduite) : événement émis sur A reçu par un membre connecté sur B.
4. Room hôtel : événement émis sur A reçu par un membre connecté sur B (reprise du test `emitHotelEvent` existant, étendu à 2 serveurs).
5. Room conversation : `new-message` émis sur A reçu par un participant connecté sur B.
6. Présence d'un même utilisateur multi-instance : `isUserOnline`/équivalent distribué reste vrai tant qu'au moins un socket existe sur N'IMPORTE quelle instance.
7. Déconnexion d'un socket sur une instance ne doit jamais annoncer l'utilisateur offline si un autre de ses sockets est actif ailleurs.
8. Une room tenant/hôtel/conversation reste impossible à rejoindre sans autorisation, même à travers l'adaptateur distribué (non-régression de la sécurité déjà prouvée en mono-instance, §12).
9. Panne Redis simulée pendant le fonctionnement : les connexions Socket.IO existantes continuent de fonctionner en mode dégradé (intra-instance uniquement), sans crash.
10. Absence de duplication d'événements côté client lors d'une bascule reconnect/adaptateur.

## 23. Score détaillé (§70-§71)

| Sous-score | Note /100 | Justification |
|---|---:|---|
| Socket discovery | 90 | Architecture compacte, un seul fichier central, facilement auditable |
| Auth/room authority | 90 | JWT + tokenVersion + statut + tenant context, revalidation à chaque join et à chaque broadcast hôtel, prouvé par tests d'intégration Mongo réels — aucune fuite cross-tenant démontrée |
| Cross-instance delivery | 15 | Aucun adaptateur distribué ; tout événement temps réel échoue silencieusement dès que émetteur et destinataire sont sur des instances différentes |
| Presence correctness | 35 | Correct intra-instance (multi-device/tab) ; sous-évaluation systémique cross-instance, avec un effet de bord réel sur le fallback push |
| Durable fallback | 80 | Persistance systématique avant émission (messages, notifications, réservations) ; polling web serré (3-60 s) ; polling mobile plus faible dans le cas spécifique split-instance |
| Tenant safety | 92 | Isolation prouvée par tests réels sur les trois types de rooms |
| Failure recovery | 55 | Aucune perte de donnée démontrée nulle part ; récupération garantie mais parfois lente (jusqu'à une réouverture manuelle pour les écrans hôtel) |
| Observability | 30 | Logs de connexion/déconnexion présents mais sans identifiant d'instance ni métriques |
| 10× readiness | 25 | Le mécanisme de repli (DB + polling) tient à 10 instances, mais l'expérience temps réel se dégrade proportionnellement au nombre d'instances |
| **Score synthétique** | **54** | Moyenne arrondie des neuf axes |

**Estimation après le futur hotfix (Blocks A+B+C bien testés) : 80-85/100** — plafonnée par le fait qu'un système de présence distribuée reste intrinsèquement plus complexe à rendre parfaitement cohérent qu'un verrou de job (contrairement aux jobs, la présence change en continu, pas seulement à des ticks discrets). Cette fourchette n'est pas forcée : elle reflète que la persistance/polling (déjà solide) resterait le filet de sécurité, tandis que l'adaptateur distribué résoudrait la majorité du gap de livraison temps réel identifié.

## 24. Matrice finale (§76)

| Surface | Persistence | Socket room | Cross-instance today | Fallback | Severity |
|---|---|---|---|---|---|
| Messages | `Message` (DB) | `id` utilisateur | Non | Polling 3 s web / 30 s mobile conditionnel | P2 |
| Notifications (générique) | `Notification` (DB) | `id` utilisateur | Non | Push (si token) + polling 30-60 s | P1* |
| Presence | Aucune (advisory) | N/A (`onlineUsers` local) | Non | Aucun — mais n'est utilisée que pour décider d'un push, jamais pour une décision métier critique | P1 |
| Tenant fan-out (staff) | `Notification` par destinataire | `id` utilisateur (par destinataire) | Non, par destinataire | Identique au cas Notification | P1 (hérité) |
| Hôtel (réservations/tâches) | Entité métier (DB, transactionnelle pour l'expiration) | `hotel:<id>` | Non | **Aucun polling dédié trouvé** | P2 |
| Conversation (rooms) | `Conversation`/`Message` (DB) | `conv:<id>` | Non | Polling messagerie | P2 |

*P1 sur Notifications spécifiquement à cause de l'interaction avec la présence incorrecte (§7/§18), pas parce que la notification elle-même serait perdue (elle est toujours persistée et récupérable par polling/consultation).

## 25. Réponses aux questions obligatoires (70)

1. **Branche ?** `main`. 2. **HEAD ?** `f56774e317680aca1bb3992d8d03c0623215f451`. 3. **Worktree ?** Identique à l'état laissé par le hotfix Distributed Jobs (non modifié par ce mandat). 4. **diff-check initial ?** Vert.

5. **Où Socket.IO est initialisé ?** `server/socket.js::initSocket`, appelé une fois depuis `server.js`.

6. **Adapter actuel ?** Adaptateur en mémoire par défaut de Socket.IO (aucune option `adapter` fournie à `new Server()`).

7. **Redis adapter présent ?** Non. 8. **Cluster adapter présent ?** Non. 9. **Redis dependency serveur présente ?** Non, confirmé par le hotfix Distributed Jobs (`package.json` inchangé) et reconfirmé ici (aucune importation Redis nulle part dans `server/`).

10. **Presence utilise Map/Set local ?** Oui, `onlineUsers = new Map()`. 11. **Combien de stores mémoire socket ?** Un seul store applicatif dédié (`onlineUsers`) + l'adaptateur interne de rooms de Socket.IO lui-même (non applicatif, interne à la librairie).

12. **User rooms existent ?** Oui (`socket.userId`). 13. **Tenant rooms existent ?** **Non** — n'existent pas ; diffusion tenant = fan-out applicatif. 14. **Hotel rooms existent ?** Oui (`hotel:<id>`). 15. **Conversation rooms existent ?** Oui (`conv:<id>`).

16. **Room IDs dérivés côté serveur ?** Oui pour la room utilisateur (JWT). Pour hôtel/conversation, l'ID est proposé par le client mais **l'autorité d'accès est systématiquement revérifiée côté serveur** avant tout join.

17. **Un client peut-il joindre arbitrairement un tenant ?** Sans objet (pas de room tenant) ; pour le contexte tenant actif de la connexion elle-même, non — résolu via `resolveEffectiveTenantContext`, qui vérifie l'appartenance réelle.

18. **Une fuite cross-tenant est-elle démontrée ?** **Non — activement démontrée absente** par deux tests d'intégration Mongo réels couvrant conversation, hôtel et contexte multi-tenant d'un même utilisateur.

19. **Même user sur deux instances : presence correcte ?** **Non, potentiellement incorrecte** (sous-évaluation locale par instance) — voir §7.

20. **Disconnect d'une instance peut-il annoncer offline à tort ?** **Oui, du point de vue de CETTE instance uniquement** — jamais un faux "online" global, seulement un faux "offline" localisé.

21. **Event user A→B cross-instance fonctionne ?** **Non.** 22. **Tenant broadcast cross-instance fonctionne ?** Sans objet en tant que room ; chaque destinataire individuel suit le cas 21. 23. **Hotel broadcast cross-instance fonctionne ?** **Non.** 24. **Conversation broadcast cross-instance fonctionne ?** **Non.** 25. **Direct socketId cross-instance fonctionne ?** **Non.**

26. **Messages sont persistés avant emit ?** **Oui**, systématiquement. 27. **Notifications persistées avant emit ?** **Oui**, systématiquement.

28. **Socket perdu = perte définitive ou retard ?** **Retard**, jamais perte définitive démontrée — la DB reste la source de vérité, récupérable par polling ou consultation directe.

29. **Polling fallback existe ?** Oui. 30. **Où ?** `client/lib/hooks/useNotifications.js` (cloche, 30 s), `useDashboardBadges.js` (badges, 60 s), `client/lib/components/messaging/ChatWindow.jsx` (chat web, 3 s), `altimmo-app/src/screens/Messagerie/ChatScreen.jsx`/`ConversationsScreen.jsx` (mobile, 30 s conditionnel au socket), `client/lib/pages/dashboard/InternalMessagingPage.jsx`, `client/lib/pages/dashboard/VisitesPage.jsx`. 31. **Cadence ?** Voir détail ci-dessus, de 3 s à 60 s selon la surface — **aucune trouvée pour les écrans hôtel temps réel** (P2, §9/§18).

32. **Web reconnect ?** Oui, `socket.on('connect', join)` re-rejoint les rooms actives à chaque reconnexion (`useHotelRealtime.js`). 33. **Mobile utilise Socket.IO ?** Oui, confirmé (`altimmo-app/src/services/socketService.js`, utilisé par `ChatScreen.jsx`/`ConversationsScreen.jsx`).

34. **Sticky sessions nécessaires ?** Pour un déploiement multi-instance sans adaptateur distribué, oui en théorie pour au moins stabiliser la connexion d'un client à une instance donnée — mais **insuffisantes seules** (§56). 35. **Sticky sessions suffisantes ?** **Non**, jamais, quel que soit l'usage — elles ne partagent pas l'état des rooms entre instances. 36. **Production sticky config confirmée ?** **NON CONFIRMÉ** — aucun fichier de configuration de déploiement (`render.yaml`, etc.) trouvé dans le repo, et cet environnement n'a pas accès au tableau de bord Render.

37. **Plusieurs instances Socket sûres aujourd'hui ?** Sûres du point de vue perte de données et sécurité tenant ; **pas sûres** du point de vue expérience temps réel instantanée. 38. **2 instances ?** Conditionnel, tel que décrit. 39. **10 instances ?** Conditionnel, même mécanisme amplifié.

40. **Presence fiable à 2 instances ?** Non, sous-évaluation possible (§7). 41. **Messagerie realtime fiable ?** Non en direct cross-instance, mais oui en pratique via le polling serré (3 s web / 30 s mobile conditionnel). 42. **Staff inbox realtime fiable ?** Idem messagerie. 43. **Hotel realtime fiable ?** Non en direct cross-instance, et sans polling de repli dédié — le point le plus faible identifié (P2). 44. **Notification bell fiable ?** Oui en pratique (polling 30-60 s, indépendant de Socket.IO).

45. **Cross-tenant safe ?** Oui, démontré. 46. **Tests socket existants ?** Oui, deux fichiers, rigoureux sur l'autorisation/l'isolation intra-instance. 47. **Vrai test 2 servers existe ?** **Non**, confirmé absent.

48. **Metrics socket ?** Aucune trouvée. 49. **Instance ID logs ?** Aucun trouvé — dette confirmée.

50. **Principal P1 ?** Absence totale d'adaptateur distribué, rendant toute diffusion cross-instance (user/tenant/hôtel/conversation) silencieusement inopérante.

51. **P0 ?** 0. 52. **P1 ?** 2. 53. **P2 ?** 4. 54. **P3 ?** 1.

55. **Redis nécessaire pour Socket.IO horizontal ?** **CONDITIONAL** — nécessaire pour restaurer une vraie expérience temps réel multi-instance, pas pour éviter une perte de données (déjà couverte). 56. **Sticky sessions seules suffisent-elles ?** **Non**, jamais, structurellement (§56, §15).

57. **Architecture cible minimale ?** Adaptateur Socket.IO distribué (Redis) + présence agrégée via les primitives de l'adaptateur, contrats de livraison documentés, polling de repli comblé pour les écrans hôtel, tests à 2 serveurs. 58. **Presence cible ?** Option B (`fetchSockets()`/état d'adaptateur distribué), pas un compteur Redis maison parallèle. 59. **Redis outage strategy ?** Dégradation vers le comportement actuel (isolation par instance), pas un fail-closed dangereux — les connexions elles-mêmes survivent, seule la diffusion cross-instance serait temporairement perdue, déjà couverte par persistance/polling.

60. **Score actuel ?** 54/100. 61. **Score estimé après hotfix ?** 80-85/100 (non forcé, fourchette justifiée §23).

62. **Code modifié ?** **NON.** 63. **Package installé ?** **NON.** 64. **Redis lancé ?** **NON.** 65. **Commit ?** **NON.** 66. **Push ?** **NON.** 67. **Deploy ?** **NON.**

68. **Rapport créé ?** Oui, le présent fichier, seul fichier créé par ce mandat. 69. **diff-check final ?** Vert, inchangé.

70. **Verdict ?** **B — MULTI-INSTANCE MOSTLY SAFE WITH DURABLE FALLBACK.**

## Verdict final

**B. MULTI-INSTANCE MOSTLY SAFE WITH DURABLE FALLBACK.**

Aucune fuite cross-tenant n'est démontrée — au contraire, l'isolation multi-tenant des rooms Socket.IO est activement prouvée par des tests d'intégration Mongo réels. Aucune perte de donnée n'est démontrée nulle part : chaque message et chaque notification est persisté en base **avant** toute tentative d'émission temps réel, et des mécanismes de polling (3 à 60 secondes selon la surface) existent déjà côté web et mobile pour rattraper toute émission Socket.IO manquée. Le point réellement cassé — démontré par lecture directe du code, pas supposé — est l'**absence totale d'adaptateur Socket.IO distribué** : dès que l'émetteur d'un événement temps réel et son destinataire ne partagent pas le même processus backend, la diffusion en direct échoue silencieusement, quel que soit le type de room (utilisateur, hôtel, conversation) ou le mécanisme (room ou socketId direct). Le point le plus fragile de la chaîne de repli est l'absence de polling dédié pour les écrans hôtel temps réel, et une interaction subtile entre présence locale et fallback push pour les utilisateurs multi-appareils répartis sur plusieurs instances.

Le minimum d'architecture distribuée nécessaire pour garantir un temps réel correct à plusieurs instances est un adaptateur Socket.IO partagé (Redis étant le candidat naturel, cohérent avec l'écosystème Node/Express déjà en place) — non pas pour éviter une corruption ou une perte de données, qui n'existent pas dans l'état actuel, mais pour restaurer une expérience utilisateur temps réel cohérente indépendamment du nombre d'instances.

**SOCKET.IO DISTRIBUTED READINESS SCORE : 54 / 100.**

Aucun code, aucune dépendance, aucune configuration, aucune donnée n'a été modifié au cours de ce mandat. Aucun commit, push ou déploiement n'a été effectué.
