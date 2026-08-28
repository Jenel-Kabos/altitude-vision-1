// server/models/ImapSyncCheckpoint.js
// HOTFIX-ZOHO-IMAP-SEEN-CHECKPOINT-1 — curseur de synchronisation IMAP,
// indépendant du flag `\Seen` (voir ZOHO_INBOX_HEALTHCHECK1_ROOT_CAUSE.md).
// Une seule ligne par (account, mailbox) : `account` identifie le compte
// Zoho interrogé (valeur de `ZOHO_FROM_EMAIL`, jamais un secret), `mailbox`
// le dossier IMAP concerné (aujourd'hui uniquement 'INBOX', le poller ne
// lit aucun autre dossier — voir HOTFIX_ZOHO_IMAP_SEEN_CHECKPOINT1_CHECKPOINT_DESIGN.md).
const mongoose = require('mongoose');

const imapSyncCheckpointSchema = new mongoose.Schema({
  account: { type: String, required: true },
  mailbox: { type: String, required: true, default: 'INBOX' },
  // Stocké en String : UIDVALIDITY peut dépasser Number.MAX_SAFE_INTEGER sur
  // certains serveurs IMAP (valeur souvent dérivée d'un timestamp Unix côté
  // serveur, mais la RFC 3501 ne garantit qu'un entier 32 bits non signé —
  // String évite toute perte de précision, jamais utilisé arithmétiquement).
  uidValidity: { type: String, required: true },
  // Dernier UID confirmé traité de façon contiguë depuis le début de la
  // synchronisation courante (jamais avancé au-delà d'un message en échec
  // — voir le contrat d'avancement dans zohoImapService.js).
  lastProcessedUid: { type: Number, required: true, default: 0 },
}, { timestamps: true });

imapSyncCheckpointSchema.index({ account: 1, mailbox: 1 }, { unique: true });

module.exports = mongoose.model('ImapSyncCheckpoint', imapSyncCheckpointSchema);
