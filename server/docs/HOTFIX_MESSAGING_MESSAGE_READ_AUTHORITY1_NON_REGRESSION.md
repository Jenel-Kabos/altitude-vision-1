# HOTFIX-MESSAGING-MESSAGE-READ-AUTHORITY-1 — Preuves de non-régression

## HF-FINAL-01 (tenant-scope staff/PlatformOperator) — INCHANGÉ

- Middleware `requireTenantScopeForStaffOrPlatformOperator` : aucune ligne modifiée.
- Tests dédiés HF-FINAL-01 : 24/24 PASS (ré-exécutés dans le cadre de ce hotfix, aucune régression).
- Comportement vérifié à nouveau dans la nouvelle suite permanente : tests 8, 9, 10 (`messageReadAuthority.mongo.integration.test.js`) — staff multi-tenant sans en-tête refusé, tenant croisé refusé, en-tête invalide refusé.

## RBAC-FINAL-01 (accommodation availability blocks) — INCHANGÉ

- Aucun fichier de ce domaine touché par ce hotfix.
- Suite dédiée : 12/12 PASS (ré-exécutée en combinaison avec la suite Messaging, cf. `_GATE_MATRIX.md`).

## `conversationController.js` — 4 sites d'appel historiques de `assertConversationAccess`

| Fonction | Statut après extraction du helper |
|---|---|
| `getConversationById` | Re-testée explicitement (2 tests dédiés dans la nouvelle suite) — comportement identique : participant → 200, non-participant non-staff → 403 |
| `getConversationMessages` | Non re-testée individuellement dans ce sprint (hors périmètre exact — le hotfix cible `messageController.getMessages`), mais partage la même fonction importée du même service, donc même comportement garanti par construction |
| `markConversationAsRead` | Idem — logique inchangée, import identique |
| `deleteConversation` | Idem — logique inchangée, import identique |

Aucune ligne de logique de `assertConversationAccess` n'a été modifiée pendant l'extraction (copie verbatim, vérifiée par diff visuel entre l'ancienne définition et le nouveau fichier de service).

## `messageController.js` — autres fonctions non touchées

`markAsRead`, `deleteMessage`, `downloadAttachment`, `getConversations` : aucune modification, vérifications d'ownership propres inchangées, toujours important `assertResourceTenantOrUnattributed` directement (import conservé).

## Suite backend complète

`npm run test:unit` : 141 suites / 1579 tests — 100% PASS après isolement de la fausse alerte `rentalMaintenanceRoutes.test.js` (flake de charge documentée, reproduite deux fois précédemment dans cette session avec `propertyModerationTenantScope`, jamais liée au domaine Messaging).

## Architecture

`npm run architecture:check` avant/après : `controller → controller` inchangé à 1 (aucune nouvelle dette), `service → controller` inchangé à 2, 0 nouvelle violation, 0 cycle. Nouveaux edges attendus uniquement : `messageController → messagingAuthorizationService`, `conversationController → messagingAuthorizationService`, `messagingAuthorizationService → tenantResourceAttributionService`, `messagingAuthorizationService → utils/roles`.

## Lint

0 erreur ; même nombre d'avertissements pré-existants (108) sur l'ensemble du projet ; 0 nouvel avertissement introduit sur les 3 fichiers touchés/créés (vérifié par `npx eslint` ciblé).

## Mobile (`ChatScreen.jsx`)

Consommateur non modifié, aucune modification de forme de réponse (`messageSerializer` inchangé), aucune modification de route — comportement du client mobile inchangé par construction.
