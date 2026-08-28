# HOTFIX-CONVERSATION-ACTIVE-ATTACHMENT-1 — MATRICE DE SÉCURITÉ

| Dimension | Constat | Preuve |
|---|---|---|
| HTML actif exécutable via attachment Conversation | **Non atteignable** par le chemin de création vivant | `messageAttachmentMimeFilter.test.js`, `_THREAT_MODEL.md` |
| SVG actif exécutable | **Non atteignable** | Idem |
| MIME spoofing | Possible mais **sans impact d'exécution** (le Blob reste typé selon la valeur stockée, jamais réinterprété) | `_THREAT_MODEL.md`, cas `evil-renamed.png` |
| Extension bypass (double extension, casing, query/fragment) | **Non pertinent ici** — le mécanisme de classification par extension n'est pas la barrière de sécurité de ce système ; la barrière réelle est le `fileFilter` sur le MIME **déclaré à l'upload**, indépendant du nom de fichier | `_THREAT_MODEL.md` |
| `localStorage`/parent DOM/top navigation/popup | **Non applicable** — aucun contexte d'exécution actif n'est jamais atteint | `_THREAT_MODEL.md` |
| Téléchargement | Inchangé, comportement historique préservé (`openConversationAttachment`, `download:true`) | Analyse de code, aucune modification |
| Fichiers passifs (image/PDF/audio/vidéo) | Non régressés — aucun code touché | `messageAttachmentMimeFilter.test.js` (accepté), suite complète backend |
| Contrat `Message` (ARCH-2C2) | Intact | `conversationRoutes.test.js`, `conversationStaffInboxTenant.test.js`, `messageSerializer.test.js` — 30/30 |
| Socket.IO | Intact, non modifié | Aucun fichier touché |
| `unread`/`isRead`/`readAt` | Intact | Aucun fichier touché |
| Tenant / Ownership / IAM / RBAC | Intact | Aucun fichier touché |
| `InternalMail` / SECURITY-1 / SECURITY-2 | Intacts, aucun fichier partagé touché | `emailRoutesAuth.test.js` (15/15) rejoué |
| Backend complet | 1555/1556 verts (1 échec `hotelOperationsRoutes.test.js` — flake réseau `socket hang up`, confirmé pré-existant et sans rapport par ré-exécution isolée : 35/35 verts en isolation) | `npm run test:unit` |
| Architecture | PASS, 0 nouvelle violation | `npm run architecture:check` |
| Lint | 0 nouvelle erreur | `npx eslint __tests__/messageAttachmentMimeFilter.test.js` |
| Frontend | **Non modifié** — aucun build/lint/suite client requis (mandat §49 : obligatoire seulement si le frontend est modifié) | — |
| `git diff --check` | Propre | Vérifié |
| Règle métier | Aucune ajoutée/modifiée | — |
| Production | Aucune mutation, aucune commande git | — |

## Risque résiduel documenté (non bloquant)

Attachments "legacy" `url`-based (`streamRemoteDocument`, passthrough Content-Type non contraint) — aucun chemin de création vivant trouvé, existence de données historiques non vérifiée (hors périmètre d'accès DB de ce mandat). Recommandation : un audit ponctuel `Message.find({'attachments.url': {$exists: true}})` en environnement de production, hors périmètre de ce hotfix.
