# HOTFIX-MESSAGING-MESSAGE-READ-AUTHORITY-1 — Périmètre exact du diff

`git rev-parse HEAD` avant et après ce hotfix : `a04055f62952c782b92aeef2f100824a17a5f645` (inchangé — aucun commit créé, conformément à la contrainte permanente de ne jamais commiter/pusher).

## Fichiers créés ou modifiés par ce hotfix (extrait filtré de `git status --short`)

```
 M server/controllers/conversationController.js
 M server/controllers/messageController.js
?? server/__tests__/messageReadAuthority.mongo.integration.test.js
?? server/services/messagingAuthorizationService.js
?? server/docs/HOTFIX_MESSAGING_MESSAGE_READ_AUTHORITY1_ETAT_INITIAL.md
?? server/docs/HOTFIX_MESSAGING_MESSAGE_READ_AUTHORITY1_FLOW.md
?? server/docs/HOTFIX_MESSAGING_MESSAGE_READ_AUTHORITY1_EXISTING_CONTRACT.md
?? server/docs/HOTFIX_MESSAGING_MESSAGE_READ_AUTHORITY1_RED_REPRODUCTION.md
?? server/docs/HOTFIX_MESSAGING_MESSAGE_READ_AUTHORITY1_ROOT_CAUSE.md
?? server/docs/HOTFIX_MESSAGING_MESSAGE_READ_AUTHORITY1_AUTHORITY_MATRIX.md
?? server/docs/HOTFIX_MESSAGING_MESSAGE_READ_AUTHORITY1_SIDE_EFFECT_MATRIX.md
?? server/docs/HOTFIX_MESSAGING_MESSAGE_READ_AUTHORITY1_NON_REGRESSION.md
?? server/docs/HOTFIX_MESSAGING_MESSAGE_READ_AUTHORITY1_GATE_MATRIX.md      (à créer ensuite)
?? server/docs/HOTFIX_MESSAGING_MESSAGE_READ_AUTHORITY1_DIFF_SCOPE.md       (ce fichier)
?? server/docs/HOTFIX_MESSAGING_MESSAGE_READ_AUTHORITY1_DECISION.md         (à créer ensuite)
?? server/docs/HOTFIX_MESSAGING_MESSAGE_READ_AUTHORITY1_REPORT.md           (à créer ensuite)
```

## Code — récapitulatif du diff minimal (2 fichiers modifiés, 1 fichier créé)

| Fichier | Nature du changement | Lignes de logique modifiées |
|---|---|---|
| `server/services/messagingAuthorizationService.js` | Nouveau fichier | ~15 lignes de logique (extraction verbatim, 0 ligne nouvelle de comportement) |
| `server/controllers/conversationController.js` | Import ajouté, définition locale retirée | -1 import, -~20 lignes (fonction déplacée, pas supprimée en substance) |
| `server/controllers/messageController.js` | Import ajouté, 1 bloc `if` remplacé par 1 appel | +1 import, ~4 lignes remplacées par 1 ligne |

## Test — 1 fichier créé, permanent

`server/__tests__/messageReadAuthority.mongo.integration.test.js` — 14 tests, conservé (pas de suppression prévue, contrairement au test temporaire de l'assessment précédent).

## Ce qui n'a PAS été touché (vérifié par absence dans `git status --short` filtré ci-dessus)

- `server/middleware/*` (y compris `requireTenantScopeForStaffOrPlatformOperator`, HF-FINAL-01) — intact.
- `server/routes/messageRoutes.js`, `server/routes/conversationRoutes.js` — intacts, aucune route ajoutée/modifiée.
- `server/services/messagingSerializer` / `messageSerializer` — intact.
- Tout fichier `client/` ou `altimmo-app/` lié à Messaging (`ChatScreen.jsx`, `messageService.js`) — intacts (le `M client/lib/services/messageService.js` visible dans le `git status` global du dépôt est un changement pré-existant, antérieur à ce hotfix, sans rapport avec ce mandat — confirmé par `_ETAT_INITIAL.md`, qui documentait déjà un arbre de travail non propre de 602 lignes avant le début de ce hotfix).
- Aucun modèle Mongoose modifié (`Conversation.js`, `Message.js`, `User.js` intacts).

## Note sur l'arbre de travail global

Le dépôt contenait déjà, avant le début de ce hotfix (documenté dans `_ETAT_INITIAL.md`), un arbre de travail avec ~602 lignes de modifications non commitées réparties sur de nombreux fichiers sans rapport avec Messaging (issues de mandats/sessions antérieurs, hors périmètre). Ce hotfix n'a ajouté **aucune** modification à ces fichiers préexistants — seuls les fichiers listés ci-dessus ont été créés ou modifiés par ce mandat précis.
