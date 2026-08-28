# MESSAGING-MESSAGE-READ-AUTHORITY-ASSESSMENT-1 — Flux de l'endpoint

## Route exacte

`GET /api/messages/:conversationId` → `messageController.getMessages`.

## Montage confirmé (LIVE, pas une route morte)

`server.js:547` : `app.use("/api/messages", messageRoutes);` → `routes/messageRoutes.js:51` : `router.get('/:conversationId', requireTenantScopeForStaffOrPlatformOperator, getMessages);`.

## Chaîne de middleware exacte, dans l'ordre

1. `router.use(protect, attachTenantContext)` (`messageRoutes.js:24`) — authentification JWT obligatoire (401 sinon) ; résout `req.platformTenant` sans jamais bloquer.
2. `requireTenantScopeForStaffOrPlatformOperator` (`messageRoutes.js:51`, ajoutée par HF-FINAL-01) — pour un STAFF/PlatformOperator sans tenant résolu (ambigu ou aucune adhésion), bloque 403. **No-op total** pour tout rôle non-staff (Client, Proprietaire) — `requireWhen` renvoie `false` immédiatement, `next()` sans aucune vérification.
3. `messageController.getMessages` — voir ci-dessous.

## Corps du contrôleur (`controllers/messageController.js:280-362`)

1. Valide le format de `conversationId` (regex hex 24 caractères) — pas une vérification d'autorité, une validation de type.
2. `Conversation.findById(conversationId)` — charge la conversation, **sans aucun filtre** (ni participant, ni tenant, ni staff).
3. `if (req.platformTenant) { await assertResourceTenantOrUnattributed(...) }` — **uniquement si `req.platformTenant` est déjà résolu** (donc uniquement pertinent pour un staff/PlatformOperator déjà passé l'étape 2 ; toujours `undefined` pour un Client/Proprietaire, donc cette ligne ne s'exécute jamais pour ces rôles). Vérifie la correspondance tenant, **jamais l'appartenance à la conversation**.
4. Calcule `otherParticipant` sans vérifier si `req.user` lui-même est un participant.
5. `Message.find({conversation: convDoc._id, ...})` — retourne **tous** les messages de la conversation, peu importe qui les demande.
6. `Message.updateMany({conversation: convDoc._id, sender:{$ne:req.user.id}, isRead:false}, {isRead:true, readAt:Date.now()})` — **effet de bord en écriture**, exécuté pour n'importe quel appelant, y compris un non-participant.
7. Retourne `messages.map(serializeMessage)` — voir `_AUTHORITY_MODEL.md` pour le contenu exact exposé.

## Aucune vérification participant/staff/ownership à aucune étape

Confirmé par lecture exhaustive de la fonction (lignes 280-362) : ni `conversation.participants.includes(req.user.id)`, ni `ALL_STAFF.includes(req.user.role)`, ni aucun appel à un helper d'autorisation (contrairement à `assertConversationAccess` dans `conversationController.js` ou au `staffAllowed`/`participant` de `downloadAttachment` dans ce même fichier).

## Ordre des contrôles (mandat §19)

**C. Jamais** — aucune vérification d'autorité (participant/staff/ownership) n'existe à aucun point de la chaîne pour cet endpoint précis. Seule une vérification de **tenant** existe (étape 3), et uniquement pour les acteurs qui ont un `req.platformTenant` résolu.
