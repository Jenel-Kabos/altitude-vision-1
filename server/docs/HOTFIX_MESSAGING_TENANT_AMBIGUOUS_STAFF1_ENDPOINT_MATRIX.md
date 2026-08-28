# HOTFIX-MESSAGING-TENANT-AMBIGUOUS-STAFF-1 — Inventaire des endpoints concernés

Reconstruit par lecture directe de `routes/conversationRoutes.js` et `routes/messageRoutes.js` (montés respectivement à `/api/conversations` et `/api/messages` dans `server.js:546-547`), pas depuis l'historique.

| Method | Endpoint | Mounted | Auth | RBAC (avant) | Tenant resolution (avant) | Handler | Read/Write | Statut HF-FINAL-01 |
|---|---|---|---|---|---|---|---|---|
| GET | `/api/conversations/count/unread` | LIVE | `protect` | tout rôle | `requireTenantScopeForStaffOrPlatformOperator` (fail-closed pour staff) | `getUnreadCount` | Read (compteur) | **Déjà sûr** — référence canonique |
| GET | `/api/conversations/staff-inbox` | LIVE | `protect` | `restrictTo(...ALL_STAFF)` | **Aucune** — `attachTenantContext` seul (ne bloque jamais) | `getStaffInbox` | Read (liste, contenu complet) | **🔴 Vulnérable — corrigé par ce hotfix** |
| GET | `/api/conversations/my-inbox` | LIVE | `protect` | tout rôle | Aucune, mais bornée par `participants: req.user.id` | `getMyInbox` | Read | Sûr par construction (ownership), non modifié |
| POST | `/api/conversations/start` | LIVE | `protect` | tout rôle | Calcul serveur (`resolveConversationTenantId`), jamais un `find` cross-tenant | `startConversation` | Create | Hors périmètre (création, pas une fuite de lecture existante), non modifié |
| GET | `/api/conversations/` | LIVE | `protect` | tout rôle | Aucune, mais bornée par `participants: req.user.id` | `getConversations` | Read | Sûr par construction, non modifié |
| POST | `/api/conversations/` (déprécié) | LIVE | `protect` | tout rôle | `activeTenantId(req)` calculé serveur | `createOrGetConversation` | Create | Hors périmètre, non modifié |
| GET | `/api/conversations/:conversationId` | LIVE | `protect` | tout rôle (staff OU participant via `assertConversationAccess`) | **Aucune garde routeur** — dépend de `assertConversationAccess`, qui ignore l'absence de tenant | `getConversationById` | Read (détail complet) | **🔴 Vulnérable — corrigé par ce hotfix** |
| GET | `/api/conversations/:conversationId/messages` | LIVE | `protect` | idem | idem | `getConversationMessages` | Read (contenu messages) | **🔴 Vulnérable — corrigé par ce hotfix** |
| PATCH | `/api/conversations/:conversationId/mark-read` | LIVE | `protect` | idem | idem | `markConversationAsRead` | Write (état lu) | **🔴 Vulnérable — corrigé par ce hotfix** |
| DELETE | `/api/conversations/:conversationId` | LIVE | `protect` | idem | idem | `deleteConversation` | **Delete** (destructif) | **🔴 Vulnérable — corrigé par ce hotfix** |
| POST | `/api/messages` | LIVE | `protect` | tout rôle | `if (req.platformTenant) {...}` — même défaut que ci-dessus (chemin `conversationId`) | `sendMessage` | **Write (création message + notifications + socket)** | **🔴 Vulnérable — corrigé par ce hotfix** |
| GET | `/api/messages/:conversationId` | LIVE | `protect` | tout rôle | `if (req.platformTenant) {...}` — même défaut | `getMessages` | Read (contenu messages) | **🔴 Vulnérable pour la dimension tenant — corrigé par ce hotfix.** ⚠️ Comporte séparément une absence totale de vérification participant/staff (même en tenant résolu) — **cause racine différente, documentée comme NEW_MESSAGING_FINDING_OUT_OF_SCOPE dans `_ROOT_CAUSE.md`, non corrigée ici.** |
| PATCH | `/api/messages/:messageId/read` | LIVE | `protect` | ownership stricte (`message.receiver===req.user.id`), indépendante du tenant | `if (req.platformTenant) {...}` mais garde ownership after | `markAsRead` | Write | **Déjà sûr** — ownership vérifiée indépendamment de la résolution tenant |
| DELETE | `/api/messages/:messageId` | LIVE | `protect` | ownership stricte (`sender OU receiver===req.user.id`) | idem | `deleteMessage` | Delete | **Déjà sûr** |
| GET | `/api/messages/conversations` | LIVE | `protect` | tout rôle | bornée par `sender/receiver===req.user.id` indépendamment du tenant | `getConversations` (messageController) | Read | Sûr par construction, non modifié |
| GET | `/api/messages/:messageId/attachments/:attachmentId` | LIVE | `protect` | `staffAllowed` exige tenant résolu ET correspondant, sinon `participant` | déjà fail-closed pour staff ambigu | `downloadAttachment` | Read (fichier) | **Déjà sûr**, non modifié |

## Total

16 endpoints inventoriés dans le périmètre Messaging (`conversationRoutes.js` + `messageRoutes.js`), tous **LIVE** (aucune route morte dans ce domaine). **7 endpoints corrigés** par ce hotfix : 5 dans `conversationRoutes.js` (`staff-inbox`, `GET/:conversationId`, `GET/:conversationId/messages`, `PATCH/:conversationId/mark-read`, `DELETE/:conversationId`) + 2 dans `messageRoutes.js` (`POST /`, `GET /:conversationId`).
