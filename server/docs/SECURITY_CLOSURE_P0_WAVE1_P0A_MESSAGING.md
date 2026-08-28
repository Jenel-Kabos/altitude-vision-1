# P0-A — Messaging Send Authority (RA-01)

## Rouge (avant correctif)

Suite `server/__tests__/securityClosureP0WaveMessagingSendAuthority.mongo.integration.test.js`, 13 tests. Avec le correctif désactivé temporairement (`assertConversationAccess` commenté) : **6/13 échoués** — exactement les scénarios non-participant/cross-tenant/staff-cross-tenant (tests 1, 2, 3, effet de bord lastMessage, test 9, test 11).

## Root cause

`messageController.sendMessage` chargeait `Conversation.findById(conversationId)` puis calculait `targetUserId` sans jamais vérifier que l'appelant soit participant réel ou staff de cette conversation. La seule vérification existante (`if (req.platformTenant) {...}`) n'a aucun effet pour Client/Proprietaire (jamais de `req.platformTenant`).

## Correctif

Remplacement de l'ancienne vérification tenant-seule par `await assertConversationAccess(req, convDoc);` — même fonction déjà utilisée par `getMessages` (HOTFIX-MESSAGING-MESSAGE-READ-AUTHORITY-1) et 4 fonctions de `conversationController.js`. Aucune nouvelle logique de routage (staffInbox/1-à-1) modifiée — seule l'autorité d'accès est ajoutée, avant `Message.create`, notification et émission Socket.

Fichier modifié : `server/controllers/messageController.js` (1 ligne remplacée par 1 appel, dans `sendMessage` uniquement).

## Vert (après correctif)

**13/13 PASS.** Autorité staff tenant-wide préservée (test 5 : staff non-participant sur conversation privée d'un collègue → 201, comme pour la lecture). HF-FINAL-01 (tenant ambigu, cross-tenant, en-tête invalide) reconfirmé intact (tests 8, 9, 10).

## Statut : **CLOSED**
