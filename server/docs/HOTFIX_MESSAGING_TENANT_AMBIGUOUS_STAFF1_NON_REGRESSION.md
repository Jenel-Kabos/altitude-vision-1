# HOTFIX-MESSAGING-TENANT-AMBIGUOUS-STAFF-1 — Non-régression

## Fichiers de production modifiés (2, uniquement du câblage de routeur)

- `server/routes/conversationRoutes.js` — ajout de `requireTenantScopeForStaffOrPlatformOperator` (déjà importée, déjà utilisée par `/count/unread`) sur `GET /staff-inbox`, `GET /:conversationId`, `GET /:conversationId/messages`, `PATCH /:conversationId/mark-read`, `DELETE /:conversationId`. **Aucune ligne de `conversationController.js` modifiée.**
- `server/routes/messageRoutes.js` — import ajouté + même middleware sur `POST /` et `GET /:conversationId`. **Aucune ligne de `messageController.js` modifiée.**

Aucun autre fichier de production touché — ni modèle, ni service métier, ni `messageSerializer.js`, ni `socket.js`, ni frontend, ni mobile.

## Preuves de non-régression

| Suite | Résultat |
|---|---|
| `messagingTenantAmbiguousStaff.mongo.integration.test.js` (nouvelle, permanente) | 24/24 PASS |
| `conversationStaffInboxTenant.test.js`, `conversationRoutes.test.js`, `messageSerializer.test.js`, `messageAttachmentMimeFilter.test.js` (existants, Messaging) | 54/54 PASS (les 4 + la nouvelle suite ensemble) |
| Cluster HZ-01→HZ-07 (8 fichiers) | 137/137 PASS — identique à l'état pré-hotfix |
| Backend complet (`npm run test:unit`) | 141 suites / 1579 tests — PASS, identique |
| Architecture (`npm run architecture:check`) | Identique avant/après — 472 fichiers, 1531 edges, 0 cycle, 0 unresolved, PASS |
| Lint | 0 erreur, 108 warnings pré-existants, aucun nouveau, aucun sur les fichiers modifiés |
| `git diff --check` | Propre (1 avertissement CRLF pré-existant sur `messageRoutes.js`, ligne de fin déjà présente dans le fichier, sans rapport avec le contenu ajouté) |

## Représentation canonique Message (ARCH-2C2)

`messageSerializer.js` non modifié, `messageSerializer.test.js` vert sans adaptation — la représentation canonique du Message reste intacte, exactement comme l'exige le mandat.

## Contrat Socket.IO

`socket.js` non modifié. Le payload `getIO().emit('new-message'/'new-staff-message', {conversationId, message})` reste strictement identique pour tout envoi autorisé (même tenant) — pour un envoi refusé (ambigu/cross-tenant), l'appel `getIO().emit(...)` n'est simplement jamais atteint (bloqué en amont par le garde routeur, avant même la création du message) — zéro emit fantôme, zéro payload modifié.

## Pièces jointes (SECURITY-2)

Aucun fichier de `client/` touché, aucune règle MIME modifiée. `messageAttachmentMimeFilter.test.js` vert sans adaptation. Pour une tentative d'envoi cross-tenant avec pièce jointe, le garde routeur bloque la requête **avant** le middleware `uploadAttachments` (multer) — aucun appel à `uploadPrivateAsset`/Cloudinary n'est jamais déclenché pour une requête refusée.
