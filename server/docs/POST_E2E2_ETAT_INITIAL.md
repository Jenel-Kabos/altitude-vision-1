# POST-E2E-2 — État initial

Date : 2026-08-17, suite immédiate de POST-E2E-1. Branche `main`, HEAD `ab5ae586fab50ddce02e65ea081330d2769c6503`, inchangé au démarrage.

## 1. État Git au démarrage

Identique à la clôture de POST-E2E-1. `git diff --check` : `exit 0`. Aucun commit.

## 2. Matrice d'audit initiale

| Surface | Route mobile | API | Auth | Tenant source | Authorization | Deep-link | Socket | État |
|---|---|---|---|---|---|---|---|---|
| Notification → conversation | `NotificationsScreen.handlePress` → `resolveNavigation` | `GET /api/conversations/:id` (via legacy resolver) | requise | résolu depuis la ressource (Property) au moment de la création | `assertConversationAccess` (participant/staff) | non (in-app uniquement) | non | **Cassé** : `USER_DESTINATIONS['message_staff']='MESSAGES'` court-circuite le résolveur legacy correct avec une destination générique |
| Conversation list (client) | `ConversationsScreen` | `GET /conversations` uniquement | requise | n/a (filtre participant) | implicite (participants: req.user.id) | non | `new-message` | **Cassé** : n'interroge jamais `/conversations/my-inbox`, exclut structurellement les conversations `isStaffInbox:true` |
| Refus accès conversation | `getConversationById`/`getConversationMessages` | `GET /api/conversations/:id[/messages]` | requise | n/a | `assertConversationAccess` | non | non | **Cassé** : erreur non nommée, `errorMiddleware.js` retombe sur 500 au lieu de 403/404 |
| Hotel deep-link | Profil > HotelCockpit etc. | `GET /api/dashboard-analytics/hotels` | requise | résolu via `assertOperationalHotelAccess` | serveur | oui, `altimmo://mes-hotels/:id` | `establishment:join` | **OK** (corrigé en POST-E2E-1, non retouché) |
| Hotel A→B | idem | idem | requise | idem | serveur | oui | leave/rejoin | **OK** (POST-E2E-1) |
| Tenant Portal | `TenantPortalScreen` | `/api/tenant-portal/*` | requise | `resolveLocataireForUser(req.user.id)` | structurel (jamais d'ID client) | non | non | **OK** (POST-E2E-1) |
| Socket reconnect | `useHotelRealtime` | n/a | n/a | n/a | serveur au rejoin | n/a | `connect` → rejoin auto | **OK** (POST-E2E-1) |

## 3. Bug 1 — notification → conversation : cause exacte (avant correction)

Chaîne tracée intégralement :
1. `server/controllers/conversationController.js`/`messageController.js` : `notify({type:'message_staff'|'new_message', recipient, data:{conversationId, screen:'Chat'}})` — payload correct, `conversationId` bien présent dans `data`.
2. `server/services/notificationService.js:notify()` appelle `buildNotificationNavigation({type, destination:null, data, audience:'user'})`.
3. `server/services/navigationService.js:buildNotificationNavigation()` résout `destinationId = destination || destinationForNotification(type,'user')` → lit `USER_DESTINATIONS[type]`.
4. **`USER_DESTINATIONS['message_staff'] = 'MESSAGES'`** (registre `MESSAGES` = liste générique des conversations, PAS `CONVERSATION` = chat précis avec `:id`). Stocké tel quel sur `notif.destination`.
5. Côté mobile, `altimmo-app/src/navigation/navigationSdk.js:resolveNotificationMobileTarget()` lit `notification.destination` (= `'MESSAGES'`) en priorité et retourne `{screen:'Messages', params:{screen:'Conversations'}}` — la liste, jamais la conversation précise — **avant même que le résolveur legacy `TYPE_TO_SCREEN['message_staff']` (qui, lui, chargerait correctement la conversation) n'ait la moindre chance de s'exécuter** (`resolveNavigation()` retourne dès que `registeredTarget` est non nul).

Le résolveur legacy per-type (`notificationsService.js`, lignes 131-147) était en réalité déjà correct (charge bien la conversation via `GET /conversations/:id`) — il n'est simplement jamais atteint. **Cette précision corrige le diagnostic initial de POST_E2E1_REPORT.md §23**, qui supposait à tort une absence totale de mapping.

## 4. Bug 2 — conversation list : cause exacte (avant correction)

`server/controllers/conversationController.js:getConversations` (route `GET /conversations`) filtre explicitement `isStaffInbox: false` (commentaire du code : « les convs staff-inbox sont via GET /staff-inbox »). `altimmo-app/src/screens/Messagerie/ConversationsScreen.jsx` n'appelle, pour un non-staff, QUE `GET /conversations` — jamais `GET /conversations/my-inbox` (route existante, prévue explicitement pour « un client/propriétaire [qui] ne voit que SA propre conversation avec l'équipe »). Une conversation `isStaffInbox:true` (le seul type qu'un client ordinaire peut avoir, per la règle métier Client↔Staff) est donc structurellement invisible dans la liste, bien que pleinement fonctionnelle par ailleurs (créable, lisible, répondable — prouvé en POST-E2E-1).

## 5. Bug 3 — 500 au lieu de 403 : cause exacte (avant correction)

`server/middleware/errorMiddleware.js` suit une convention stricte : seules les erreurs portant un `err.name` explicitement reconnu (`HotelAccessError`, `FinancialError`, etc.) voient leur `err.statusCode` honoré ; toute autre erreur retombe sur `res.statusCode === 200 ? 500 : res.statusCode`. `server/controllers/messageController.js` suit déjà la convention correcte partout (`res.status(403); throw new Error(...)`, `res.statusCode` déjà positionné avant le throw). `server/controllers/conversationController.js:assertConversationAccess()` — une fonction helper SANS accès à `res` (seul `req` lui est passé) — ne peut pas suivre ce même pattern ; elle utilisait `error.statusCode = 403` sans jamais nommer l'erreur, provoquant la chute sur le défaut 500 dans le middleware. Un second site identique existe dans `getConversationMessages` (404 « Conversation introuvable »).

## 6. Précédent architectural identifié

`server/services/hotel/hotelAccessError.js` établit déjà, pour exactement ce cas (erreur levée depuis un helper sans `res`), la convention : classe/erreur nommée + branche dédiée dans `errorMiddleware.js` lisant `err.statusCode`. La correction de Bug 3 suit ce précédent exact, sans introduire de nouveau pattern ni généraliser `.statusCode` à toute erreur.

## 7. Zones déjà certifiées, non retouchées

PMS 3/3 (MOB-E2E-2), Cockpit/Maintenance/realtime générique/cross-owner (MOB-E2E-2), création conversation/réponse staff/persistance/isolation structurelle/Tenant Portal/deep-link hôtel/Hotel A→B/Socket reconnect/network recovery/Inspection Fail (POST-E2E-1). Aucune modification prévue sur ces chemins ce sprint, sauf non-régression ciblée.

## 8. Risques avant modification

(a) `navigationService.js` est partagé par TOUS les types de notification (visites, transactions, hôtel, etc.) — la correction doit toucher UNIQUEMENT les 3 clés `new_message`/`new_staff_message`/`message_staff`, jamais les autres. (b) `ConversationsScreen.jsx` fusionne deux réponses réseau — vérifier qu'aucune régression de performance/duplication n'apparaît pour le cas staff (inchangé, toujours un seul appel). (c) `errorMiddleware.js` est un point de passage global — la nouvelle branche doit être strictement conditionnée par un nom d'erreur nouveau et spécifique (`ConversationAccessError`), jamais un comportement par défaut élargi.

## 9. Portée non retouchée par précaution

Aucune migration de données, aucun changement de modèle `Conversation`/`Notification`, aucune règle métier nouvelle. La règle « Property ownership ≠ Conversation participation » n'est touchée nulle part — `startConversation` (corrigé en POST-E2E-1) n'ajoute déjà jamais le propriétaire comme participant, confirmé par relecture, non modifié ce sprint.
