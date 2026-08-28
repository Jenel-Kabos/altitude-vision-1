# HOTFIX-INBOX-SECURITY-2 — ÉTAT INITIAL

## Baseline git

- Branche : `main`
- HEAD : `a04055f62952c782b92aeef2f100824a17a5f645` ("Update Altimmo 40") — inchangé depuis `INBOX-1` et `HOTFIX-INBOX-SECURITY-1`.
- `git status --short` : uniquement le travail parallèle non lié déjà documenté dans les hotfix précédents (`ARCH2A/2B/2C1/2C2/2C3/2C4/2D1`, `INBOX_PRO1`), plus `server/routes/emailRoutes.js` (SECURITY-1, non commité) et `server/__tests__/emailRoutesAuth.test.js` (SECURITY-1). Aucun de ces fichiers n'est écrasé.
- `git diff --check` : propre (warnings CRLF bénins pré-existants sur des fichiers non touchés par ce hotfix).

## Découverte préalable — le pipeline InternalMail a évolué depuis INBOX-1

`INBOX1_FRONTEND_AUDIT.md`/`INBOX1_ATTACHMENT_MATRIX.md` décrivaient un unique bouton indifférencié appelant `previewInternalMailAttachment`. Sur le HEAD actuel, un sprint parallèle (`INBOX_PRO1`/`INBOX_PRO2`, non lié à ce mandat, non modifié ici) a déjà :
- séparé `previewEndpoint` (`Content-Disposition: inline`) et `downloadEndpoint` (`Content-Disposition: attachment`, `?download=1`) — construits par `server/models/InternalMail.js:101-111` (transform `toJSON`) ;
- ajouté `X-Content-Type-Options: nosniff` sur `server/controllers/internalMailController.js:687` (`downloadAttachment`).

**Mais les deux boutons ("Voir" et "Télécharger") appellent toujours la même fonction cliente unique**, `previewInternalMailAttachment` (`client/lib/services/messageService.js:117-122`), qui fait un `responseType:'blob'` puis `URL.createObjectURL` puis `window.open(url, '_blank', 'noopener,noreferrer')` — **indépendamment du type de fichier et indépendamment de l'endpoint appelé**. Le `Content-Disposition` renvoyé par le serveur est consommé par le navigateur au moment du `GET` XHR, mais **n'a plus aucun effet une fois le blob reconstruit côté client** — `window.open` sur un Blob de type `text/html` sera systématiquement **rendu comme document HTML dans un nouvel onglet**, jamais sauvegardé, quel que soit l'endpoint (`previewEndpoint` OU `downloadEndpoint`) d'où il provient. Le "téléchargement" d'un fichier HTML/SVG joint n'est donc, sur le HEAD actuel, pas un téléchargement réel — c'est une seconde voie d'exécution.

## Fait technique déterminant — origine des Blob URL

Une URL `blob:` créée par `URL.createObjectURL()` **hérite de l'origine du document qui l'a créée** (ce n'est PAS une origine opaque, contrairement à ce que suggérait la formulation prudente de `INBOX1_ATTACHMENT_MATRIX.md`, §"reste un vecteur de phishing/exécution non négligeable"). Un document HTML/SVG hostile ouvert via `window.open(blobURL)` depuis le dashboard s'exécute donc **avec la même origine que `altitudevision.agency`**, avec accès à `localStorage` (où le JWT est stocké, `client/lib/services/api.js:29`) — un script dans ce document pourrait lire le token sans avoir besoin de `window.opener` (déjà neutralisé par `noopener`). **Ce constat révise à la hausse la sévérité indiquée par `INBOX1_ATTACHMENT_MATRIX.md`/`INBOX1_SECURITY_MATRIX.md`** : il ne s'agit pas seulement d'un "vecteur de phishing", mais d'un vecteur de vol de session (JWT) same-origin, via une pièce jointe `.html`/`.svg` reçue par email (y compris un email externe entrant via IMAP Zoho, dont les pièces jointes suivent le même pipeline de stockage/preview que les emails internes — `zohoImapService.js` alimente le même modèle `InternalMail`).

## Revalidation directe du finding (source, pas recopiée)

- `client/lib/components/messaging/AttachmentStrip.jsx` (68 lignes) — confirmé : `onClick={() => previewInternalMailAttachment(att.previewEndpoint)}` et `onClick={() => previewInternalMailAttachment(att.downloadEndpoint)}`, aucune branche par type.
- `client/lib/services/messageService.js:117-122` — confirmé : une seule fonction, aucune vérification de `mimetype`/extension.
- `client/lib/components/messaging/SafeHtmlEmailViewer.jsx` — confirmé sain (DOMPurify + iframe `srcDoc` sandbox `allow-popups allow-popups-to-escape-sandbox`, sans `allow-scripts`/`allow-same-origin`), déjà testé (`SafeHtmlEmailViewer.test.jsx`, 12 cas). **Ce composant n'est PAS dans la chaîne des pièces jointes** — uniquement pour `message.html` (corps de l'email), confirmé par grep (`InternalMessagingPage.jsx:526` : `AttachmentStrip` est un composant frère, pas un enfant de `SafeHtmlEmailViewer`).
- `server/controllers/internalMailController.js:657-689` (`downloadAttachment`) — confirmé : `Content-Type` = `attachment.asset.mimeType || attachment.mimetype` (MIME déclaré par l'expéditeur au moment de l'ingestion IMAP, jamais re-vérifié par signature — cohérent avec `INBOX1_SECURITY_MATRIX.md` ligne "spoof MIME"), ownership vérifiée (`sender/receiver === userId`, inchangé, non touché par ce hotfix).

**Le finding P0 est confirmé.**

## Ce qui NE sera PAS touché (rappel du périmètre)

Authentification/`ROLES_DOCS`/RBAC (SECURITY-1), tenant, ownership, PlatformOperator, IMAP, SMTP, `InternalMail` (modèle), archivage/suppression/read/unread/starred/reply/forward, permissions attachments, mobile (`altimmo-app/`), redesign de la boîte de réception, CID, tracking pixel.

## Documents à produire (ce hotfix)

`HOTFIX_INBOX_SECURITY2_PREVIEW_MATRIX.md`, `_THREAT_MODEL.md`, `_BEHAVIOR_CONTRACT.md`, `_SECURITY_MATRIX.md`, `_REPORT.md` (ce fichier `_ETAT_INITIAL.md` déjà produit).
