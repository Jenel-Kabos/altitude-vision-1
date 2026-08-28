# HOTFIX-MESSAGING-MESSAGE-READ-AUTHORITY-1 — Cause racine (rappel + correctif)

## Cause racine (déjà établie par l'assessment, reconfirmée ici)

`messageController.js::getMessages` n'appliquait aucune vérification `participants.includes`/staff-scopée — seulement une vérification tenant optionnelle (`if (req.platformTenant) {...}`), sans effet pour Client/Proprietaire (jamais de `req.platformTenant`). Toutes les autres fonctions de lecture/écriture du domaine Messaging appliquent au moins l'une de ces vérifications via `assertConversationAccess` (4 sites dans `conversationController.js`) ou une vérification d'ownership stricte propre (`markAsRead`, `deleteMessage`, `downloadAttachment` dans `messageController.js`).

## Primitive canonique identifiée et réutilisée

`assertConversationAccess(req, conversation)` — tenant (identique à l'ancien code) **+** `isStaff(ALL_STAFF) || participant`. Contrat prouvé, pas inventé (voir `_EXISTING_CONTRACT.md`) : réutilisé par 4 fonctions indépendantes de `conversationController.js` avant ce hotfix, désormais aussi par `messageController.js::getMessages`.

## Pourquoi une extraction de service plutôt qu'un import controller→controller

`npm run architecture:check` suit explicitement `controller → controller` comme une catégorie de dette limitée (`1` occurrence connue, non nulle mais suivie). Importer `assertConversationAccess` directement depuis `conversationController.js` dans `messageController.js` aurait ajouté un **nouvel** edge controller→controller, risquant de faire échouer le critère « 0 nouvelle violation ». La fonction a donc été déplacée **verbatim** (aucune ligne de logique modifiée) vers `services/messagingAuthorizationService.js`, respectant le sens de dépendance déjà dominant du projet (controller → service). Résultat mesuré : `controller → controller` reste à **1** (inchangé), `service → controller` reste à **2** (inchangé) — aucune nouvelle dette introduite, seulement 4 nouveaux edges légitimes (2× controller→service, 2× service→service) pour le nouveau fichier.

## Correction minimale — récapitulatif

| Fichier | Changement |
|---|---|
| `services/messagingAuthorizationService.js` (nouveau) | `assertConversationAccess`, copiée verbatim depuis `conversationController.js` |
| `controllers/conversationController.js` | Import ajouté ; définition locale de `assertConversationAccess` retirée (les 4 sites d'appel restent identiques, inchangés) |
| `controllers/messageController.js` | Import ajouté ; dans `getMessages`, `if (req.platformTenant) { assertResourceTenantOrUnattributed(...) }` remplacé par `await assertConversationAccess(req, convDoc)` |

Aucune autre fonction modifiée. Aucune route modifiée. Aucun middleware modifié.

## Ce qui reste hors périmètre (confirmé non touché)

- `errorMiddleware.js` (500 vs 404 pour `assertResourceTenant*`) — non corrigé, documenté comme dette séparée, préexistante, sans impact sécurité (le refus reste réel).
- HZ-08 (`assertResourceTenantOrUnattributed`, ressources legacy) — non modifié.
- HZ-09 (`resolveTenantForUser`) — non modifié.
- `sendMessage` (chemin `conversationId`) — non ré-audité au même niveau de détail dans ce sprint (hors périmètre exact du mandat, qui cible `getMessages`) ; noté `NON CONFIRMÉ` pour référence future.
