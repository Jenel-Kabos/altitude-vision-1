# HOTFIX-MESSAGING-MESSAGE-READ-AUTHORITY-1 — Matrice d'autorité (`GET /api/messages/:conversationId`)

Contrat appliqué après correctif : `assertConversationAccess(req, conversation)` = (tenant résolu ⇒ tenant identique ou conversation non-attribuée) **ET** (`isStaff` (ALL_STAFF) **OU** `participant réel`).

| # | Acteur | Tenant (en-tête) | Participant ? | Type conversation | Résultat attendu | Statut | Preuve test |
|---|---|---|---|---|---|---|---|
| 1 | Client A | — | Non | Privée (Client B/C, sans tenant) | Refusé | 403 | test 1 |
| 2 | Proprietaire A | — | Non | Privée (Client B/C, sans tenant) | Refusé (même chemin que Client) | 403 | test 2 |
| 3 | Client A | — | Non | Attribuée tenant B | Refusé | 403 | test 3 |
| 4 | Client B | — | Oui | Privée (Client B/C, sans tenant) | Autorisé, historique | 200 | test 4 |
| 5 | Staff A (Collaborateur, tenant A) | Tenant A | Non (collègue staffB est participant, pas staffA) | Privée 1-1 non-staff-inbox, tenant A | **Autorisé — autorité staff tenant-wide PRÉSERVÉE, pas fermée par ce hotfix** | 200 | test 5 |
| 6 | Admin A | Tenant A | Non | Privée 1-1, tenant A | Autorisé (autorité Admin = staff) | 200 | test 6 |
| 7 | PlatformOperator (scopé tenant A) | Tenant A | Non | Privée 1-1, tenant A | Autorisé (rôle sous-jacent Admin ∈ ALL_STAFF, tenant résolu) | 200 | test 7 |
| 8 | Staff multi-tenant | Aucun en-tête (ambigu) | — | Tenant A | Refusé (HF-FINAL-01 inchangé) | 403 | test 8 |
| 9 | Staff A | Tenant A | Non | Attribuée tenant B (croisé) | Refusé | ≠200 | test 9 |
| 10 | Staff A | Tenant étranger (aucune adhésion) | — | Tenant A | Refusé (HF-FINAL-01 inchangé) | 403 | test 10 |

## Note explicite sur la ligne 5 (le point potentiellement contre-intuitif du mandat)

Le mandat cite en exemple illustratif « staff même-tenant non-participant sur conversation privée → refusé » comme hypothèse à vérifier (§ liste de scénarios). L'investigation (voir `_EXISTING_CONTRACT.md`) démontre que ce n'est **pas** le contrat déjà en production : `assertConversationAccess`, réutilisée identiquement par 4 fonctions de `conversationController.js` avant ce hotfix, autorise tout staff du même tenant sur toute conversation de ce tenant, y compris une conversation privée d'un collègue, sans restriction `isStaffInbox`. Corriger `getMessages` pour restreindre ce cas précis aurait constitué une **invention de nouvelle politique Messaging**, explicitement interdite par le mandat (§ »NE PAS INVENTER UNE NOUVELLE POLITIQUE MESSAGING »). Le hotfix préserve donc ce comportement à l'identique — ce n'est pas un oubli, c'est une décision documentée et testée (test 5, passant avant ET après correctif — ce n'était pas un cas rouge).

## Cas non couverts par cette matrice (hors périmètre de ce hotfix)

- `sendMessage` (écriture) — non ré-audité à ce niveau de détail dans ce sprint (cible = `getMessages`, lecture).
- `markAsRead` / `deleteMessage` / `downloadAttachment` dans `messageController.js` — utilisent déjà leur propre vérification d'ownership stricte, non touchée, non re-testée en profondeur ici (hors du gap identifié).
