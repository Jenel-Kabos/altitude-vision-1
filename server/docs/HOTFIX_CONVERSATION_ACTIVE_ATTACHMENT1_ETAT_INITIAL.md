# HOTFIX-CONVERSATION-ACTIVE-ATTACHMENT-1 — ÉTAT INITIAL

## Baseline git

- Branche : `main`
- HEAD : `a04055f62952c782b92aeef2f100824a17a5f645` ("Update Altimmo 40") — inchangé.
- `git status --short` : 202 lignes — travail parallèle déjà documenté (`ARCH2*`), plus mes hotfix non commités des sprints précédents (SECURITY-1, SECURITY-2, MOB-ADD-PROPERTY-BEDROOMS-1). Aucun écrasement.
- `git diff --check` : propre.

## Documents lus avant toute action

`HOTFIX_INBOX_SECURITY2_FINAL_REPORT.md`, `_BYPASS_AUDIT.md`, `_ADVERSARIAL_MATRIX.md`, `_FINAL_SECURITY_MATRIX.md` (SECURITY-2), `ARCH2C2_REPORT.md`, `ARCH2C2_MESSAGE_CONTRACT.md`, `ARCH2C2_BEHAVIOR_CONTRACT.md`, `ARCH2C2_SECURITY_MATRIX.md` — tous relus intégralement.

## Séparation confirmée des deux systèmes

`InternalMail` (Zoho/IMAP/email, `SafeHtmlEmailViewer`, `AttachmentStrip.jsx`, `SafeAttachmentPreview.jsx`, `attachmentSecurity.js`, `sanitizeSandboxedHtml.js` — tous SECURITY-2, non touchés ici) est un système **entièrement distinct** de `Conversation`/`Message` (chat temps réel, `conversationService.js`, `Message.js`, `Conversation.js`, `messageController.js`, `conversationController.js`, `messageSerializer.js`). Confirmé par lecture directe : aucun fichier n'est partagé entre les deux chaînes de composants frontend (`AttachmentStrip.jsx` n'est importé que par `InternalMessagingPage.jsx`, jamais par `MessagesPage.jsx`/`StaffInboxPage.jsx`).

## Revalidation directe du finding — résultat déterminant

Contrairement à l'hypothèse de départ ("mécanisme structurellement analogue"), l'audit complet de la chaîne backend révèle une **différence architecturale majeure** : `server/config/cloudinary.js:45-63` définit un `fileFilter` multer sur l'objet `upload` (utilisé par `messageRoutes.js:11`, `uploadAttachments = upload.array('attachments', 5)`, **seul point de création** d'un attachment `Message`) qui n'autorise que :
```js
ALLOWED_IMAGE_MIMES = ['image/jpeg','image/png','image/webp','application/pdf']
ALLOWED_VIDEO_MIMES = ['video/mp4','video/quicktime','video/x-msvideo','video/webm']
ALLOWED_AUDIO_MIMES = ['audio/mpeg','audio/mp4','audio/aac','audio/wav','audio/webm','audio/x-m4a']
```
**`text/html`, `application/xhtml+xml`, `image/svg+xml` ne figurent dans aucune de ces listes** — un fichier déclaré avec l'un de ces trois MIME est rejeté (`400`, "Format non supporté") avant tout stockage, tel que confirmé empiriquement par `server/__tests__/messageAttachmentMimeFilter.test.js` (10/10 tests verts, créé pendant cet audit).

`InternalMail` n'a **aucun** filtre équivalent car son ingestion se fait par IMAP (`zohoImapService.js`), depuis des expéditeurs externes non contrôlables — c'est précisément l'absence de ce type de filtre qui rendait le finding SECURITY-2 réel. Ce n'est pas le cas ici : voir `_THREAT_MODEL.md` pour l'analyse complète, y compris pourquoi un contournement par usurpation de MIME (déclarer `image/png` pour des octets HTML) n'aboutit pas à une exécution de code (le `Content-Type` réellement servi reste celui stocké, `image/png`, jamais `text/html`).

## Conclusion préliminaire

**Le finding n'est PAS confirmé comme vulnérabilité exploitable via le seul chemin de création vivant (`POST /api/messages`).** Un risque résiduel étroit et non confirmé (attachments historiques `url`-based, voir `_THREAT_MODEL.md`) est documenté séparément, sans preuve d'existence de telles données ni de chemin vivant permettant de les créer aujourd'hui.

Conformément au mandat §62, **aucune modification de code de production n'a été effectuée.**
