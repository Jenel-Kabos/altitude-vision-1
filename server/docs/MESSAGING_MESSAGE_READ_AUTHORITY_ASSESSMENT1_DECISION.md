# MESSAGING-MESSAGE-READ-AUTHORITY-ASSESSMENT-1 — Décision

## Verdict retenu

**A. AUDIT CERTIFIÉ — FIX REQUIRED.**

## Justification (conditions du mandat §57, toutes remplies)

- **Endpoint LIVE** : `GET /api/messages/:conversationId`, monté et confirmé activement utilisé en production par `altimmo-app/src/screens/Messagerie/ChatScreen.jsx`.
- **Acteur non autorisé réel** : Client authentifié sans aucun lien avec la conversation (reproduit), staff même tenant non-participant sur une conversation privée d'un collègue (reproduit).
- **Conversation non autorisée réelle** : conversations privées 1-à-1 créées pour le test, sentinelles, aucune donnée réelle.
- **Lecture réellement obtenue** : HTTP 200, contenu complet du message + identités sender/receiver retournés.
- **Contrat métier interdisant cet accès** : prouvé par symétrie — toutes les autres fonctions de lecture du même domaine Messaging (`getConversationById`, `getConversations`, `getMyInbox`, `getStaffInbox`, `downloadAttachment`) appliquent une vérification participant et/ou staff-scopée ; `getStaffInbox` limite explicitement l'autorité staff à la boîte partagée, jamais aux conversations privées d'un autre staff.
- **Protection manquante clairement identifiée** : aucune vérification `participants.includes(req.user.id)` ni équivalent staff-scopé n'existe dans `getMessages`, à la différence de toutes ses fonctions sœurs.

## Ce que cette décision NE dit PAS

Elle ne dit pas que HF-FINAL-01 ou RBAC-FINAL-01 sont remis en cause — les deux restent fermés et non affectés (revérifiés verts). Elle ne dit pas non plus que `sendMessage`, `markAsRead`, `deleteMessage`, `downloadAttachment` sont vulnérables de la même façon — trois d'entre eux ont une vérification d'autorité réelle déjà confirmée ; seul `sendMessage` reste `NON CONFIRMÉ` au même niveau de détail (non ré-examiné dans ce sprint, hors périmètre exact du mandat qui cible `getMessages`).

## Prochaine étape recommandée (non exécutée)

**Ne pas** lancer `TENANT-SCOPE-HORIZONTAL-CLOSURE-REAUDIT-1` immédiatement. Prochaine étape : `HOTFIX-MESSAGING-MESSAGE-READ-AUTHORITY-1` (voir `_REPORT.md` §"Si FIX REQUIRED" pour l'invariant, la surface et le guard probable). Ce n'est qu'après la fermeture de ce hotfix que la campagne tenant-scope aurait un périmètre Messaging complet pour un audit de clôture.
