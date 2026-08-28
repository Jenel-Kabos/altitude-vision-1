# INBOX-1 — PIPELINE MIME (PREUVE CODE:LIGNE)

## Point d'entrée IMAP

`imapflow@1.6.5` (installé, `package.json` épingle `^1.2.18`). Connexion dans `server/services/zohoImapService.js:184-195` :
```js
client = new ImapFlow({ host: 'imap.zoho.com', port: 993, secure: true,
  auth: { user: process.env.ZOHO_FROM_EMAIL, pass: process.env.ZOHO_IMAP_PASSWORD },
  connectionTimeout: 15000, socketTimeout: 30000 });
```
**Aucun push/IDLE — purement cron.** Déclencheurs dans `server/server.js` : un déclenchement unique 10s après connexion Mongo (`server.js:48-56`) puis un cron `*/5 * * * *` (`server.js:89-96`) appelant `pollZohoInbox()`. À l'intérieur (`zohoImapService.js:160-304`) : `client.search({ seen: false })` (ligne 218), `client.fetchAll(uidBatch, { uid: true, source: true }, { uid: true })` par lots de 10 (ligne 229), marquage `\Seen` après traitement (ligne 255).

SMTP sortant : `nodemailer@8.0.4` (`emailService.js:365-366`, envois avec pièces jointes) ; les envois simples passent par l'API HTTP Zoho Mail (`zohoMailService.sendEmail`).

## Bibliothèque de parsing MIME

**`mailparser`, version installée 3.9.14** (`package-lock.json`, `package.json` épingle `^3.9.6`). Un seul point d'appel dans tout `server/` : `zohoImapService.js:47` — `simpleParser(message.source)`, **sans aucune option** passée en second argument.

**Réponse à la question P0 : le système actuel permet-il de reconstruire fidèlement un email HTML avec images CID ?**

**NON.**

Preuve : `parsed.attachments` est itéré (`zohoImapService.js:83-99`) mais seuls `att.content`, `att.filename`, `att.contentType`, `att.size` sont lus. **`att.contentId`/`att.cid`/`att.related`/`att.contentDisposition` ne sont jamais lus, jamais persistés, nulle part dans `services/`, `controllers/`, ou `models/`** (confirmé par recherche exhaustive). Une image inline `multipart/related` référencée par `<img src="cid:image001@example">` dans le HTML est aujourd'hui traitée comme une pièce jointe opaque et uploadée sur Cloudinary comme n'importe quel fichier joint (voir section Stockage) — mais **rien ne relie ce fichier à la référence `cid:` laissée telle quelle dans le champ `html` persisté**. Un email HTML avec images inline, une fois affiché, afficherait donc des images cassées (`src="cid:..."` non résolu par aucun navigateur).

## Multipart — géré uniquement par les défauts de la bibliothèque

Aucune logique multipart personnalisée n'existe dans le code (`simpleParser(message.source)` sans options). `multipart/alternative` (texte vs HTML) est délégué entièrement aux défauts de `mailparser`, qui expose `.text` et `.html` séparément — ce comportement par défaut est correctement exploité (`parsed.text`/`parsed.html` sont bien lus, voir ci-dessous). `multipart/related` (images inline) est également délégué aux défauts de la bibliothèque, qui les expose dans `.attachments` avec un flag `related`/`cid` — **mais le code applicatif ignore ce flag**, donc le traitement en aval ne distingue jamais une pièce jointe "vraie" d'une image inline destinée au rendu HTML.

## Données extraites (`zohoImapService.js:49-60`, `processFetchedMessage`)

| Champ parsé | Traitement | Persisté sous |
|---|---|---|
| `parsed.from.value[0].address`/`.name` | Direct | `senderEmail`/`senderName` |
| `parsed.to.value[0].address` | Lower-case/trim, fallback `ZOHO_FROM_EMAIL` | `receiverEmail`, résout `recipientUser` |
| `parsed.subject` | Défaut `'(Sans objet)'` | `subject` (schéma limite 200 caractères, aucune troncature explicite dans le code) |
| `parsed.text` | **Tronqué à 10 000 caractères** (ligne 58) | `content` (avec repli HTML/placeholder) |
| `parsed.html` | **Tronqué à 200 000 caractères** (ligne 59) | `html` |
| `parsed.messageId` | Repli `imap-uid-${uid}-${Date.now()}` si absent | `zohoMessageId`, clé de déduplication |
| `parsed.attachments[].content/.filename/.contentType/.size` | Upload Cloudinary individuel | `attachments[]` |

**Jamais lus ni utilisés** : `parsed.headers`, `parsed.inReplyTo`, `parsed.references`, `parsed.cc`, `parsed.date` (l'email est daté uniquement via `timestamps: true` de Mongoose — l'horodatage réel de l'en-tête `Date:` de l'email n'est pas conservé, seule la date d'ingestion serveur l'est).

## Stockage des pièces jointes

**Ni MongoDB binaire, ni abandon — upload Cloudinary en asset privé/authentifié.** `zohoImapService.js:85-95` :
```js
const asset = await uploadPrivateAsset(att.content, {
  purpose: 'administrative', ownerType: 'InternalMail', ownerId: messageId,
  filename: att.filename, mimeType: att.contentType || 'application/octet-stream',
});
attachmentDocs.push({ filename: att.filename, asset, mimetype: att.contentType || 'application/octet-stream', size: att.size || att.content.length || 0 });
```
`uploadPrivateAsset` (`services/storage/secureStorageService.js:54-78`) → `uploadToCloudinary(buffer, { type: 'authenticated', ... })` → seul un descripteur (`publicId`, `resourceType`, `deliveryType: 'authenticated'`, `version`, `format`, `mimeType`, `size`) est stocké dans Mongo (sous-schéma `privateAssetSchema`) — **les octets bruts vivent exclusivement sur Cloudinary, jamais en base**. Le même mécanisme sert les pièces jointes composées par l'utilisateur (envoi sortant, `internalMailController.js:9-16`).

## Fichiers annexes trouvés — clarification de périmètre (ne pas confondre)

- **`documentStreamingService.js`** (nouveau, non commité) : proxy HTTP générique de streaming pour d'anciennes pièces jointes en `url`/`filepath` (pré-migration Cloudinary-asset), utilisé transversalement par de nombreux contrôleurs métier sans rapport (locataire, maintenance locative, documents locatifs, portail locataire, paiement, litige, signalement, propriétaire) — **pas spécifique à IMAP/MIME**, seulement un repli legacy dans `internalMailController.js:675` pour des enregistrements historiques sans `attachment.asset`.
- **`messageSerializer.js`/`notificationObservationPort.js`** (nouveaux, non commités) : appartiennent au système de **chat interne** (`Message`/`Conversation`), un domaine **différent** de l'email externe (`InternalMail`) — `serializeMessage` n'est appelé que par `conversationController.js`/`messageController.js`, jamais par `internalMailController.js`/`zohoImapService.js`. Le modèle `Message.js` possède un champ `tenant` (`ObjectId, ref: 'PlatformTenant'`) — **`InternalMail.js` n'en a aucun** (voir `INBOX1_ARCHITECTURE.md`). Ces deux systèmes ne doivent pas être confondus dans la suite de cet audit ni dans une future roadmap.

## Charset/encodage

Aucune conversion de charset personnalisée nulle part (recherche exhaustive de `charset`/`iconv`/`decode`/`encoding` sans résultat pertinent) — entièrement délégué aux défauts internes de `mailparser`. La seule logique liée à l'encodage concerne la sécurité des noms de fichiers dans les en-têtes HTTP, pas le charset MIME : `secureStorageService.js:10-11` (normalisation NFKD + suppression non-ASCII pour la clé de stockage Cloudinary, n'affecte pas le nom de fichier original conservé en métadonnée) et `internalMailController.js:684` (`safeName = ...replace(/[\r\n"\\]/g, '_')`, protection anti-injection d'en-tête HTTP pour `Content-Disposition`, pas un encodage RFC 5987 conscient du charset).
