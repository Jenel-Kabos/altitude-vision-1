# INBOX-1 — ARCHITECTURE DU PIPELINE COMPLET

## Chemin réel confirmé (bout en bout, vérifié par lecture directe)

```
Zoho (IMAP, imap.zoho.com:993)
  → server/services/zohoImapService.js — ImapFlow, cron */5 * * * * (server.js:89-96)
  → simpleParser(message.source)  (mailparser@3.9.14, zohoImapService.js:47, aucune option)
  → extraction partielle (text/html/from/to/subject/messageId — PAS headers/inReplyTo/references/cc/date/cid)
  → pièces jointes → uploadPrivateAsset() → Cloudinary (asset privé/authentifié)
  → InternalMail.create() (server/models/InternalMail.js)
  → server/routes/internalMailRoutes.js (protect uniquement, pas de RBAC/tenant)
  → server/controllers/internalMailController.js (getInbox/getSent/downloadAttachment, ownership sender/receiver)
  → client/lib/services/messageService.js → api.get('/internal-mails/received'...)
  → client/lib/pages/dashboard/InternalMessagingPage.jsx (/dashboard/messages)
  → ConversationViewer (inline) → SafeHtmlEmailViewer.jsx (DOMPurify + iframe sandboxed)
  → AttachmentStrip.jsx → previewInternalMailAttachment() → blob → window.open
```

**Confirmé par vérification croisée directe** (`grep` sur `messageService.js`) : `InternalMessagingPage.jsx` consomme bien `/internal-mails/*`, le même modèle `InternalMail` peuplé par le pipeline IMAP — ce n'est pas une supposition, les deux bouts de la chaîne sont bien le même système. Ce point était le risque de confusion le plus important à écarter avant de documenter la suite (mandat §9 — ne pas confondre pièce jointe/CID/HTML/texte, et implicitement ne pas confondre deux systèmes de messagerie).

## Système distinct à ne jamais confondre : le chat interne (`Message`/`Conversation`)

`server/models/Message.js`/`Conversation.js`, `server/controllers/messageController.js`/`conversationController.js`, routes `/api/messages`, `/api/conversations` — un système de **chat interne tenant-scopé** (champ `tenant: ObjectId` présent), sans rapport avec l'email Zoho. `messageService.js` (frontend) contient des fonctions pour LES DEUX systèmes dans le même fichier (`sendMessage`→`/messages`, `getConversationMessages`→`/conversations/:id/messages`), mais `InternalMessagingPage.jsx` (la boîte de réception auditée) n'utilise que les fonctions `/internal-mails/*`. `messageSerializer.js`/`notificationObservationPort.js` (nouveaux, non commités) appartiennent exclusivement à ce second système — **hors périmètre de l'email Zoho**, à ne jamais mélanger dans une future roadmap INBOX-*.

## Séparation des responsabilités — état actuel

| Responsabilité | Fichier(s) | Évaluation |
|---|---|---|
| Connexion/poll IMAP | `zohoImapService.js` (transport + poll) | Correctement isolé du reste |
| Parsing MIME | `zohoImapService.js:47` (`simpleParser`, inline dans le même fichier que le transport) | **Responsabilité mal séparée** — le parsing MIME est fait au milieu de la fonction de traitement IMAP (`processFetchedMessage`), pas dans un module de parsing dédié et testable isolément |
| Stockage pièces jointes | `secureStorageService.js` (`uploadPrivateAsset`/`readPrivateAsset`) | Bien isolé, réutilisé par email ET par le chat interne (`messageController.js`) — bon point, pas de duplication de la couche stockage |
| Transport API | `internalMailRoutes.js` + `internalMailController.js` | Couplage direct route→controller→modèle classique, cohérent avec le reste du projet |
| Rendu frontend | `SafeHtmlEmailViewer.jsx`, `AttachmentStrip.jsx`, `ConversationList.jsx`/`Row.jsx` | Bien séparé en petits composants, sauf le conteneur de page |
| Sécurité HTML | `SafeHtmlEmailViewer.jsx` (DOMPurify + iframe sandbox) | Correctement isolée dans un composant dédié, testée (`SafeHtmlEmailViewer.test.jsx`) |

## Duplications identifiées

1. **`emailController.js`/`companyEmailController.js` vs `internalMailController.js`** — deux notions de "email" distinctes et non confondues fonctionnellement (config de comptes d'envoi vs boîte de réception réelle), mais le nommage proche (`emailRoutes.js` monté sur `/api/emails`, `companyEmailRoutes.js` sur `/api/company-emails`, `internalMailRoutes.js` sur `/api/internal-mails`) est une source de confusion documentée ici pour ne pas être reproduite dans INBOX-2+.
2. **Deux implémentations quasi identiques du téléchargement de pièce jointe** — `messageController.js` (chat interne) et `internalMailController.js` (email) réimplémentent chacune leur propre logique de vérification d'ownership + `Content-Disposition` + lecture Cloudinary, avec de légères différences (voir `INBOX1_SECURITY_MATRIX.md` — l'une utilise un nom de fichier constant `"attachment"`, l'autre un nom réel assaini). Candidat de factorisation future, non traité dans INBOX-1 (audit uniquement).

## `ARCH-2A/2B/2C1/2C2` — conformité actuelle

`npm run architecture:check` exécuté dans ce tour : **PASS, 0 nouvelle violation** (464 fichiers analysés, 1513 arêtes statiques internes, dette legacy connue et déjà trackée : 6 service→controller, 8 controller→controller, 17 route→model, aucun cycle). `server/architecture/baseline.json:229` documente explicitement qu'`ARCH-2C2` a déjà extrait `messageSerializer.js` pour supprimer une arête `conversationController → messageController` — un travail d'assainissement déjà en cours sur le domaine messagerie (chat interne), mené par un chantier parallèle non lié à cette session. **Aucune violation nouvelle ni préexistante spécifique au domaine email (`internalMailController`/`zohoImapService`) n'apparaît dans le baseline** — le pipeline email n'a pas encore été soumis au même traitement qu'`ARCH-2C2`.
