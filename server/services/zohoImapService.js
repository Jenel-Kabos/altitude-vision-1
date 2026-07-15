// server/services/zohoImapService.js
// ============================================================
// 📬 Service IMAP — Récupère les emails entrants depuis Zoho
// Utilise imapflow (moderne, sans vulnérabilités connues)
// ============================================================
const { ImapFlow }          = require('imapflow');
const { simpleParser }      = require('mailparser');
const InternalMail          = require('../models/InternalMail');
const User                  = require('../models/User');
const { uploadToCloudinary } = require('../config/cloudinary');
const logger                = require('../utils/logger');

let isPolling = false;
let pollSequence = 0;
const LOGOUT_TIMEOUT_MS = 5000;

const logoutWithDeadline = async (client) => {
    let timeoutId;
    try {
        await Promise.race([
            client.logout(),
            new Promise((_, reject) => {
                timeoutId = setTimeout(() => {
                    const error = new Error(`Logout IMAP dépassé après ${LOGOUT_TIMEOUT_MS} ms`);
                    error.code = 'IMAP_LOGOUT_TIMEOUT';
                    reject(error);
                }, LOGOUT_TIMEOUT_MS);
            }),
        ]);
    } finally {
        clearTimeout(timeoutId);
    }
};

// ── Fonction principale ───────────────────────────────────────
const pollZohoInbox = async () => {
    if (isPolling) {
        logger.warn('[IMAP] Polling ignoré : cycle déjà en cours');
        return { imported: 0, skipped: 0, errors: 0 };
    }

    isPolling = true;
    const pollCycleId = ++pollSequence;
    const startedAt = Date.now();
    let phase = 'configuration';
    let client;
    let lock;
    let connectionError = null;

    logger.info('[IMAP] Polling démarré', { pollCycleId });

    if (!process.env.ZOHO_FROM_EMAIL || !process.env.ZOHO_IMAP_PASSWORD) {
        logger.warn('⚠️ [IMAP] ZOHO_FROM_EMAIL ou ZOHO_IMAP_PASSWORD non configurés — polling ignoré');
        isPolling = false;
        return { imported: 0, skipped: 0, errors: 0 };
    }

    const stats = { imported: 0, skipped: 0, errors: 0 };

    client = new ImapFlow({
        host:              'imap.zoho.com',
        port:              993,
        secure:            true,
        auth: {
            user: process.env.ZOHO_FROM_EMAIL,
            pass: process.env.ZOHO_IMAP_PASSWORD,
        },
        logger:            false,
        connectionTimeout: 15000,  // 15 s max pour établir la connexion
        socketTimeout:     30000,  // 30 s max d'inactivité socket
    });

    // ImapFlow émet les erreurs réseau (ETIMEOUT, ECONNRESET…) via l'événement
    // 'error' de l'EventEmitter. Sans listener, Node.js traite ça comme une
    // exception non gérée et crashe le processus.
    client.on('error', (err) => {
        connectionError = err;
        logger.error('[IMAP] Erreur socket', { pollCycleId, phase, error: err.message, code: err.code });
    });

    try {
        // 1. Connexion
        phase = 'connect';
        await client.connect();
        logger.success('[IMAP] Connecté', { pollCycleId });

        // 2. Ouvrir INBOX
        phase = 'mailbox';
        lock = await client.getMailboxLock('INBOX');
        logger.info('[IMAP] Mailbox ouverte', { pollCycleId, mailbox: 'INBOX' });

        // 3. Chercher les emails non lus
        phase = 'search';
        const uids = await client.search({ seen: false });
        logger.info('[IMAP] Emails non lus trouvés', { pollCycleId, mailCount: uids.length });

        // 4. Traiter chaque email
        phase = 'process';
        for await (const message of client.fetch(uids, { source: true })) {
            try {
                    const parsed = await simpleParser(message.source);

                    const fromAddress = parsed.from?.value?.[0]?.address || '';
                    const fromName    = parsed.from?.value?.[0]?.name    || fromAddress;
                    const toAddress   = (parsed.to?.value?.[0]?.address  || process.env.ZOHO_FROM_EMAIL).toLowerCase().trim();
                    const subject     = parsed.subject   || '(Sans objet)';
                    const textContent = parsed.text      || '';
                    const htmlContent = parsed.html      || '';
                    const messageId   = parsed.messageId || `imap-uid-${message.uid}-${Date.now()}`;

                    logger.info(`  📧 [IMAP] "${subject}" — de: ${fromAddress}`);

                    // 5. Éviter les doublons
                    const existing = await InternalMail.findOne({ zohoMessageId: messageId });
                    if (existing) {
                        logger.info(`  ℹ️  [IMAP] Doublon ignoré: ${messageId}`);
                        stats.skipped++;
                        await client.messageFlagsAdd({ uid: message.uid }, ['\\Seen']);
                        continue;
                    }

                    // 5b. Uploader les pièces jointes vers Cloudinary
                    const attachmentDocs = [];
                    for (const att of (parsed.attachments || [])) {
                        if (!att.content || !att.filename) continue;
                        try {
                            const safeId = `${Date.now()}-${att.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
                            const result = await uploadToCloudinary(att.content, {
                                resource_type: 'auto',
                                folder:        'altitude-vision/email-attachments',
                                public_id:     safeId,
                                // Désactiver les transformations image sur les fichiers bruts
                                quality:      undefined,
                                fetch_format: undefined,
                                width:        undefined,
                                crop:         undefined,
                            });
                            attachmentDocs.push({
                                filename: att.filename,
                                url:      result.secure_url,
                                mimetype: att.contentType || 'application/octet-stream',
                                size:     att.size || att.content.length || 0,
                            });
                            logger.info(`  📎 [IMAP] PJ uploadée: ${att.filename}`);
                        } catch (attErr) {
                            logger.error(`  ⚠️ [IMAP] PJ non uploadée "${att.filename}":`, attErr.message);
                        }
                    }

                    // 6. Trouver le destinataire interne
                    let recipientUser = await User.findOne({ email: toAddress });
                    if (!recipientUser) {
                        logger.warn(`  ⚠️  [IMAP] ${toAddress} inconnu → recherche admin`);
                        recipientUser = await User.findOne({ role: 'Admin', isActive: true });
                    }
                    if (!recipientUser) {
                        logger.warn(`  ❌ [IMAP] Aucun destinataire — email ignoré`);
                        stats.skipped++;
                        continue;
                    }

                    // 7. Insérer en MongoDB
                    await InternalMail.create({
                        sender:         undefined,
                        senderName:     fromName,
                        senderEmail:    fromAddress,
                        receiverEmail:  toAddress,
                        receiver:       recipientUser._id,
                        subject,
                        content:        textContent || htmlContent || '(Contenu vide)',
                        priority:       'Normale',
                        isRead:         false,
                        isDraft:        false,
                        isDeleted:      false,
                        isExternalMail: true,
                        zohoMessageId:  messageId,
                        messageType:    'Email Externe',
                        attachments:    attachmentDocs,
                    });

                    // 8. Marquer comme lu dans Zoho
                    await client.messageFlagsAdd({ uid: message.uid }, ['\\Seen']);

                    logger.success(`  ✅ [IMAP] Importé pour ${recipientUser.email} : "${subject}"`);
                    stats.imported++;

                } catch (msgErr) {
                    logger.error(`  ❌ [IMAP] Erreur message:`, msgErr.message);
                    stats.errors++;
            }
        }

    } catch (error) {
        const isNetworkErr = ['ETIMEOUT', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT'].includes(error.code);
        if (isNetworkErr) {
            logger.warn('[IMAP] Échec réseau', { pollCycleId, phase, error: error.message, code: error.code });
        } else {
            logger.error('[IMAP] Échec polling', { pollCycleId, phase, error: error.message, code: error.code });
        }
        stats.errors++;
    } finally {
        try {
            lock?.release();
        } catch (error) {
            logger.warn('[IMAP] Libération mailbox impossible', { pollCycleId, error: error.message });
        }

        if (client) {
            try {
                if (client.usable && !connectionError) {
                    phase = 'logout';
                    await logoutWithDeadline(client);
                    logger.info('[IMAP] Connexion fermée', { pollCycleId });
                } else {
                    client.close();
                    logger.info('[IMAP] Connexion invalide fermée', { pollCycleId });
                }
            } catch (error) {
                // Une connexion déjà expirée ne doit pas déclencher une seconde commande IMAP.
                logger.warn('[IMAP] Fermeture IMAP incomplète', { pollCycleId, error: error.message });
                stats.errors++;
                try { client.close(); } catch {}
            }
        }

        isPolling = false;
        logger.info('[IMAP] Polling terminé', {
            pollCycleId,
            phase,
            imported: stats.imported,
            skipped: stats.skipped,
            errors: stats.errors,
            durationMs: Date.now() - startedAt,
        });
    }

    return stats;
};

module.exports = { pollZohoInbox };
