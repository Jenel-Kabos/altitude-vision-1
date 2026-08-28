# MESSAGING-MESSAGE-READ-AUTHORITY-ASSESSMENT-1 — Modèle d'autorité

## Comment `Conversation` stocke l'autorité (fait, pas supposition)

`models/Conversation.js` : `participants: [ObjectId ref User]` (tableau, généralement 2 pour un 1-à-1, ou un client seul pour `isStaffInbox:true`), `tenant: ObjectId|null`, `isStaffInbox: Boolean`. Aucun champ `assignedTo`, `owner` ou équivalent. L'autorité "normale" ailleurs dans le code repose sur `participants.includes(userId)` (le contrat déjà utilisé par `getConversations`/`getMyInbox`/`assertConversationAccess` dans `conversationController.js`).

## Contrat d'autorité déjà établi AILLEURS dans Messaging (preuve, pas supposition)

| Fonction | Fichier | Règle appliquée |
|---|---|---|
| `getConversations` | `conversationController.js` | Requête bornée par `participants: req.user.id` — jamais élargie |
| `getMyInbox` | `conversationController.js` | Idem, plus `isStaffInbox:true` |
| `getStaffInbox` | `conversationController.js` | `isStaffInbox:true` uniquement (boîte **partagée**, pas les conversations privées 1-à-1 d'autres utilisateurs), + `restrictTo(ALL_STAFF)` + tenant (HF-FINAL-01) |
| `assertConversationAccess` (utilisée par `getConversationById`, `getConversationMessages`, `markConversationAsRead`, `deleteConversation`) | `conversationController.js` | `isStaff(ALL_STAFF) \|\| participants.includes(req.user.id)` |
| `downloadAttachment` | `messageController.js` | `participant \|\| (ALL_STAFF && tenant match)` |
| `markAsRead` | `messageController.js` | `message.receiver === req.user.id` (ownership stricte) |
| `deleteMessage` | `messageController.js` | `sender===req.user.id \|\| receiver===req.user.id` (ownership stricte) |
| **`getMessages`** | `messageController.js` | **Aucune** |

**`getMessages` est la seule fonction de tout le domaine Messaging qui ne vérifie ni participant, ni staff, ni ownership.** Toutes les autres fonctions de lecture/écriture du même domaine appliquent au moins l'une de ces trois vérifications.

## Matrice conceptuelle (mandat §54)

| Actor | Same tenant | Participant | Staff authority (contrat établi ailleurs) | Lecture obtenue par `getMessages` (état actuel) |
|---|---|---|---|---|
| Client (participant réel) | N/A | Oui | N/A | Autorisé — comportement correct par coïncidence, pas par contrôle |
| Client (non-participant) | N/A | Non | N/A | **Autorisé — FAUTE D'AUTORITÉ** |
| Proprietaire (non-participant) | N/A | Non | N/A | **Autorisé — FAUTE D'AUTORITÉ** |
| Staff même tenant, non-participant, conversation NON staff-inbox | Oui | Non | Non (le contrat établi limite le staff à `isStaffInbox` + ses propres conversations, jamais les 1-à-1 privées d'un autre staff) | **Autorisé — FAUTE D'AUTORITÉ, dépasse même le contrat staff déjà établi ailleurs** |
| Staff même tenant, conversation staff-inbox ou propre conversation | Oui | Oui (staff-inbox) ou N/A | Oui | Autorisé — cohérent avec le contrat établi, mais atteint par absence de contrôle plutôt que par un contrôle positif |
| Staff tenant différent | Non | — | Non | Bloqué (403, HF-FINAL-01, `requireTenantScopeForStaffOrPlatformOperator` + `assertResourceTenantOrUnattributed`) |
| Staff sans tenant résolu | — | — | Non | Bloqué (403, HF-FINAL-01) |
| PlatformOperator global | N/A (tenant du message respecté si résolu) | Non vérifié | Hérite `isStaff`-like (rôle `Admin`) | **Autorisé sur toute conversation dont le tenant correspond ou est unresolved — FAUTE D'AUTORITÉ (participant jamais vérifié)** |
| PlatformOperator scopé A | Tenant A uniquement | Non vérifié | idem | **Autorisé sur toute conversation de A — même faute** |

## Conclusion du modèle

La frontière **tenant** (corrigée par HF-FINAL-01) fonctionne correctement pour ce qu'elle vérifie — mais elle n'a jamais été conçue pour remplacer une frontière **participant/staff-authority**, qui n'existe tout simplement pas sur cet endpoint précis. `tenant access ≠ conversation authority`, exactement la distinction que ce mandat devait vérifier.
