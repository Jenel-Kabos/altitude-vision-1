# HOTFIX-MESSAGING-TENANT-AMBIGUOUS-STAFF-1 — Matrice zéro effet de bord

| Action | Conversation | Message | Unread | Notification | Socket | Attachment | Autre |
|---|---|---|---|---|---|---|---|
| **LIST** — ambigu/cross-tenant | AUTHORIZED SAME-TENANT: retourne uniquement les conversations du tenant résolu. DENIED AMBIGUOUS: 403, requête jamais exécutée (`Conversation.find` jamais appelé — bloqué au routeur) | — | — | — | — | — | — |
| **DETAIL** — ambigu/cross-tenant | AUTHORIZED SAME-TENANT: conversation renvoyée normalement. DENIED AMBIGUOUS: 403, `Conversation.findById` jamais exécuté | — | — | — | — | — | — |
| **DELETE** — ambigu/cross-tenant | AUTHORIZED SAME-TENANT: suppression historique inchangée. DENIED AMBIGUOUS: 403, **aucun** `Message.deleteMany`/`Conversation.findOneAndDelete` exécuté — confirmé par assertion DB (`Conversation.findById` non-null après tentative) | Aucune suppression de message tiers | N/A | Aucune | Aucun | N/A | — |
| **SEND** — ambigu/cross-tenant | AUTHORIZED SAME-TENANT: `lastMessage`/`unreadCount` mis à jour normalement. DENIED AMBIGUOUS: 403 avant tout accès à `Conversation.findById` — `convDoc` jamais chargé | DENIED AMBIGUOUS : **aucun** `Message.create` exécuté — confirmé (`Message.countDocuments` inchangé après tentative) | Non incrémenté pour la conversation ciblée | **Zéro notification** — `notify`/`notifyStaff` jamais appelés (code jamais atteint) | **Zéro emit** — `getIO().emit(...)` jamais appelé (code jamais atteint) | Aucun upload Cloudinary déclenché (`uploadPrivateAsset` jamais appelé — bloqué avant le middleware `uploadAttachments` lui-même, qui vient APRÈS la garde tenant dans l'ordre des middlewares) | — |
| **UNREAD COUNT** — ambigu | — | — | 403, comportement inchangé (déjà correct avant ce hotfix) | — | — | — | — |

## Preuve

Toutes les lignes "DENIED AMBIGUOUS" sont vérifiées par des assertions Mongo réelles post-appel dans `messagingTenantAmbiguousStaff.mongo.integration.test.js` (comptage de documents avant/après, relecture de `lastMessage`), pas seulement par le code HTTP retourné — voir tests 3 et 4 en particulier.

## Ordre des middlewares (POST /api/messages)

`requireTenantScopeForStaffOrPlatformOperator` est placé **avant** `uploadAttachments` (multer) dans la chaîne — un staff ambigu est rejeté avant même que le corps multipart (et d'éventuelles pièces jointes) ne soit traité, évitant tout upload Cloudinary inutile pour une requête déjà vouée au refus.
