# TENANT-SCOPE-HORIZONTAL-CLOSURE-REAUDIT-1 — Re-audit Messaging complet

Ce re-audit couvre l'ensemble de `conversationController.js`, `messageController.js`, `services/messagingAuthorizationService.js`, le routing (`conversationRoutes.js`, `messageRoutes.js`) et les handlers Socket.io (`socket.js`), après les deux hotfixs déjà certifiés (HOTFIX-MSG-STAFF-INBOX-1 historique, HF-FINAL-01, HOTFIX-MESSAGING-MESSAGE-READ-AUTHORITY-1).

## Handlers `conversationController.js` — tous SAFE

| Handler | Autorité |
|---|---|
| `getConversationById` | `assertConversationAccess` |
| `getConversations` | requête bornée à `participants: req.user.id` |
| `getConversationMessages` | `assertConversationAccess` |
| `markConversationAsRead` | `assertConversationAccess` |
| `createOrGetConversation` | `req.user.id` toujours inclus dans `participants` par construction |
| `deleteConversation` | `assertConversationAccess` |
| `getUnreadCount` | personnel borné à `receiver: req.user.id` ; agrégat staff borné par `tenantConversationFilter` + `ALL_STAFF` + route gardée par `requireTenantScopeForStaffOrPlatformOperator` |
| `startConversation` | auto-scopé (staff exige un `recipientId` explicite, client toujours restreint à `participants: req.user.id`) |
| `getMyInbox` | requête bornée à `participants: req.user.id` |
| `getStaffInbox` | `ALL_STAFF` inline + `restrictTo` + `requireTenantScopeForStaffOrPlatformOperator` route-level + filtrage `tenantConversationFilter` |

## Handlers `messageController.js`

| Handler | Autorité | Verdict |
|---|---|---|
| `sendMessage` | **AUCUNE** vérification participant/staff sur `conversationId` ; tenant sans effet pour Client/Proprietaire | **CONFIRMED GAP (RA-01)** |
| `downloadAttachment` | Vérification inline stricte (tenant conditionnel + participant réel + staff-du-tenant-exact) | SAFE, mais dette de cohérence (n'utilise pas le service partagé) |
| `getMessages` | `assertConversationAccess` (fix du hotfix précédent) | SAFE |
| `markAsRead` | `message.receiver === req.user.id` strict | SAFE |
| `deleteMessage` | `sender === user \|\| receiver === user` strict | SAFE |
| `getConversations` (propre à ce fichier) | requête bornée `sender/receiver === req.user.id` + `assertResourceTenantOrUnattributed` par item | SAFE |

## RA-01 — détail de la reproduction (vérifiée par lecture directe du code, `messageController.js:79-127`)

Branche `isStaffInbox` : `senderIsClient` est calculé uniquement à partir de l'appartenance aux `participants`. Si l'appelant n'est PAS participant (ni client réel, ni staff), la branche `else` — commentée « Staff → client » — est prise **sans aucune vérification de rôle**, et `targetUserId = convDoc.participants[0]` (le vrai client). Un message est créé avec `sender: req.user.id`, poussé en temps réel (`getIO().to(recipientIdStr).emit('new-message', ...)`) et notifié au vrai destinataire, qui le reçoit comme une réponse légitime — usurpation d'identité staff possible cross-tenant (le garde tenant ne s'applique jamais pour un Client/Proprietaire, structurellement sans `req.platformTenant`).

Branche `else` (conversation 1-à-1 classique) : `otherParticipantId = participants.find(p => p !== req.user.id)` — si l'appelant n'est pas dans la liste des participants, cette recherche renvoie simplement `participants[0]` (puisque l'appelant, absent de la liste, ne peut jamais égaler aucun élément), permettant l'injection d'un message dans la conversation privée de deux inconnus.

## Effets de bord d'un `sendMessage` non autorisé (confirmé par lecture de code)

- Un `Message` réel est persisté en base, attribué au faux expéditeur.
- `Conversation.lastMessage`/`unreadCount` sont mis à jour comme pour un message légitime.
- Un événement Socket.io `new-message`/`new-staff-message` est émis vers le(s) destinataire(s) réel(s).
- Une `Notification` persistante est créée (cloche, push Expo).
- Aucune de ces actions n'est réversible côté serveur sans intervention manuelle — c'est une mutation, pas une simple lecture refusée.

## Attachments — re-vérifiés, toujours SAFE mais incohérents

`downloadAttachment` réimplémente sa propre logique (plus stricte que le contrat canonique : exige `conversation.tenant === req.platformTenant._id` en égalité stricte, pas « tenant résolu ou non-attribué ») plutôt que d'appeler `assertConversationAccess`/le service partagé. Actuellement non exploitable, mais c'est exactement le type de dérive « copie-colle d'autorisation » qui a produit les deux hotfixs précédents — à normaliser dans un futur sprint de correction (hors périmètre read-only de cet audit).

## Unread counts — SAFE

Aucune fuite cross-tenant/cross-conversation détectée ; bornés soit par `receiver: req.user.id`, soit par `tenantConversationFilter` + garde de route.

## Socket.io — SAFE mais incohérent

`canAccessConversation` (socket.js) ne protège que `join-room`/`typing`, jamais la livraison de contenu (qui transite par des salles personnelles `userId`, pas la salle `conv:`). Sa logique est **plus stricte** que REST (rôles `STAFF_ROLES` = {Admin, Collaborateur} plus étroits que `ALL_STAFF`, et n'autorise le staff que sur `isStaffInbox`, jamais sur une conversation 1-à-1 arbitraire comme le fait REST). Aucun contournement possible via ce chemin.

## Conclusion Messaging

Le contrat canonique établi par HOTFIX-MESSAGING-MESSAGE-READ-AUTHORITY-1 est correctement et exclusivement appliqué à **tous** les chemins de lecture. Il n'a en revanche **jamais été étendu au chemin d'écriture** (`sendMessage`), qui reste un P0 ouvert (RA-01) — exactement le type de surface que le mandat demandait explicitement de re-vérifier au §25-29 plutôt que de simplement rejouer les tests déjà verts.
