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

// ── Fonction principale ───────────────────────────────────────
const pollZohoInbox = async () => {
    logger.info('📬 [IMAP] Démarrage du polling Zoho...');

    if (!process.env.ZOHO_FROM_EMAIL || !process.env.ZOHO_IMAP_PASSWORD) {
        logger.warn('⚠️ [IMAP] ZOHO_FROM_EMAIL ou ZOHO_IMAP_PASSWORD non configurés — polling ignoré');
        return { imported: 0, skipped: 0, errors: 0 };
    }

    const stats = { imported: 0, skipped: 0, errors: 0 };

    const client = new ImapFlow({
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
        logger.error('❌ [IMAP] Erreur socket (absorbée):', err.message);
    });

    try {
        // 1. Connexion
        await client.connect();
        logger.success('✅ [IMAP] Connexion Zoho établie');

        // 2. Ouvrir INBOX
        const lock = await client.getMailboxLock('INBOX');

        try {
            // 3. Chercher les emails non lus
            const uids = await client.search({ seen: false });
            logger.info(`📨 [IMAP] ${uids.length} email(s) non lu(s) trouvé(s)`);

            if (uids.length === 0) return stats;

            // 4. Traiter chaque email
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

        } finally {
            lock.release();
        }

        await client.logout();
        logger.info(`📬 [IMAP] Terminé — importés: ${stats.imported}, ignorés: ${stats.skipped}, erreurs: ${stats.errors}`);
        return stats;

    } catch (error) {
        const isNetworkErr = ['ETIMEOUT', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT'].includes(error.code);
        if (isNetworkErr) {
            logger.warn(`⚠️ [IMAP] Timeout/réseau (${error.code}) — polling ignoré, serveur intact`);
        } else {
            logger.error('❌ [IMAP] Erreur connexion:', error.message);
        }
        try { client.close(); } catch {}
        return { ...stats, errors: stats.errors + 1 };
    }
};

module.exports = { pollZohoInbox };
