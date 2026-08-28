# HOTFIX-CONVERSATION-ACTIVE-ATTACHMENT-1 — CONTRAT COMPORTEMENTAL

**Aucun code de production n'a été modifié.** Ce document constate donc un contrat **avant = après**, sur toute la matrice de types, avec la preuve produite pendant cet audit.

| Type de fichier | Avant (= après, inchangé) | Preuve |
|---|---|---|
| `image/jpeg`, `image/png`, `image/webp` | Upload accepté, preview/download via `openConversationAttachment` (Blob + ancre) | `messageAttachmentMimeFilter.test.js` (accepté), analyse de code (comportement de rendu) |
| `application/pdf` | Idem | Idem |
| `video/*`, `audio/*` (listes allowlist) | Idem | Idem |
| `text/html` | Upload **rejeté (400)** — comportement déjà en place, non introduit par ce hotfix | `messageAttachmentMimeFilter.test.js` |
| `application/xhtml+xml` | Idem | Idem |
| `image/svg+xml` | Idem | Idem |
| Fichier renommé (MIME mensonger mais autorisé) | Upload accepté (le filtre ne vérifie pas les octets), preview échoue silencieusement comme une image invalide — comportement déjà en place | `messageAttachmentMimeFilter.test.js` (cas `evil-renamed.png`) + analyse de rendu Blob |

## Contrat `Message`/ARCH-2C2 — confirmé intact

Aucune modification de `messageSerializer.js`, `models/Message.js`, `messageController.js`, `conversationController.js`, ni d'aucun payload Socket.IO. Suites rejouées cette session sans aucune modification préalable : `conversationRoutes.test.js`, `conversationStaffInboxTenant.test.js`, `messageSerializer.test.js` — 30/30 verts, contrat ARCH-2C2 (`ARCH2C2_MESSAGE_CONTRACT.md`/`_BEHAVIOR_CONTRACT.md`/`_SECURITY_MATRIX.md`) intégralement préservé par construction (zéro fichier concerné modifié).

## Nouveau test ajouté (caractérisation, pas correction)

`server/__tests__/messageAttachmentMimeFilter.test.js` — 10 tests, verrouille le comportement du `fileFilter` existant (déjà correct, non modifié) contre une régression future silencieuse (ex. quelqu'un ajoute `text/html` à l'allowlist sans connaître ce raisonnement de sécurité). N'affecte aucun comportement applicatif — un test de non-régression pur.
