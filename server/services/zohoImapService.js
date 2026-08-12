// server/services/zohoImapService.js
// ============================================================
// 📬 Service IMAP — Récupère les emails entrants depuis Zoho
// Utilise imapflow (moderne, sans vulnérabilités connues)
// ============================================================
const { ImapFlow }          = require('imapflow');
const { simpleParser }      = require('mailparser');
const InternalMail          = require('../models/InternalMail');
const User                  = require('../models/User');
const { uploadPrivateAsset } = require('./storage/secureStorageService');
const logger                = require('../utils/logger');

let isPolling = false;
let pollSequence = 0;
const LOGOUT_TIMEOUT_MS = 5000;
const FETCH_BATCH_SIZE = 10;

const isImapConnectionError = (error) => [
    'ETIMEOUT', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'NoConnection', 'EConnectionClosed',
].includes(error?.code);

const inBatches = (items, size) => {
    const batches = [];
    for (let index = 0; index < items.length; index += size) {
        batches.push(items.slice(index, index + size));
    }
    return batches;
};

const runEmailStep = async (context, step, action) => {
    const startedAt = Date.now();
    logger.info('[IMAP] Étape démarrée', { ...context, step });
    try {
        const result = await action();
        logger.info('[IMAP] Étape terminée', { ...context, step, durationMs: Date.now() - startedAt });
        return result;
    } catch (error) {
        logger.error('[IMAP] Étape échouée', {
            ...context, step, durationMs: Date.now() - startedAt, error: error.message, code: error.code,
        });
        throw error;
    }
};

const processFetchedMessage = async (message, context) => {
    logger.info('[IMAP] Email traitement démarré', context);
    const parsed = await runEmailStep(context, 'parse_mime', () => simpleParser(message.source));

    const fromAddress = parsed.from?.value?.[0]?.address || '';
    const fromName = parsed.from?.value?.[0]?.name || fromAddress;
    const toAddress = (parsed.to?.value?.[0]?.address || process.env.ZOHO_FROM_EMAIL).toLowerCase().trim();
    const subject = parsed.subject || '(Sans objet)';
    const textContent = parsed.text || '';
    const htmlContent = parsed.html || '';
    const messageId = parsed.messageId || `imap-uid-${message.uid}-${Date.now()}`;

    const duplicateCheckStartedAt = Date.now();
    logger.info('[IMAP] Étape démarrée', { ...context, step: 'duplicate_check' });
    let existing;
    try {
        existing = await InternalMail.findOne({ zohoMessageId: messageId });
    } catch (error) {
        logger.error('[IMAP] Étape échouée', {
            ...context, step: 'duplicate_check', durationMs: Date.now() - duplicateCheckStartedAt,
            error: error.message, code: error.code,
        });
        throw error;
    }
    logger.info('[IMAP] Étape terminée', {
        ...context, step: 'duplicate_check', isDuplicate: !!existing, durationMs: Date.now() - duplicateCheckStartedAt,
    });
    if (existing) {
        logger.info('[IMAP] Doublon confirmé', { ...context, isDuplicate: true });
        return { markSeen: true, status: 'duplicate' };
    }

    const attachmentDocs = [];
    for (const att of (parsed.attachments || [])) {
        if (!att.content || !att.filename) continue;
        try {
            const asset = await uploadPrivateAsset(att.content, {
                purpose: 'administrative', ownerType: 'InternalMail', ownerId: messageId,
                filename: att.filename, mimeType: att.contentType || 'application/octet-stream',
            });
            attachmentDocs.push({
                filename: att.filename,
                asset,
                mimetype: att.contentType || 'application/octet-stream',
                size: att.size || att.content.length || 0,
            });
        } catch (error) {
            logger.error('[IMAP] Pièce jointe non importée', { ...context, error: error.message });
        }
    }

    let recipientUser = await runEmailStep(context, 'resolve_recipient', () => User.findOne({ email: toAddress }));
    if (!recipientUser) {
        recipientUser = await runEmailStep(context, 'resolve_fallback_recipient', () => User.findOne({ role: 'Admin', isActive: true }));
    }
    if (!recipientUser) {
        // Aucun dossier de quarantaine IMAP n'existe dans le projet : ce rejet permanent est logué et acquitté.
        logger.warn('[IMAP] Email rejeté sans destinataire', { ...context, outcome: 'permanent_rejection' });
        return { markSeen: true, status: 'permanent_rejection' };
    }

    await runEmailStep(context, 'persist', () => InternalMail.create({
        sender: undefined,
        senderName: fromName,
        senderEmail: fromAddress,
        receiverEmail: toAddress,
        receiver: recipientUser._id,
        subject,
        content: textContent || htmlContent || '(Contenu vide)',
        priority: 'Normale',
        isRead: false,
        isDraft: false,
        isDeleted: false,
        isExternalMail: true,
        zohoMessageId: messageId,
        messageType: 'Email Externe',
        attachments: attachmentDocs,
    }));

    return { markSeen: true, status: 'imported' };
};

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

        // 4. FETCH est terminé avant toute commande IMAP suivante.
        // ImapFlow interdit explicitement les commandes imbriquées dans son itérateur fetch().
        let mailIndex = 0;
        for (const uidBatch of inBatches(uids, FETCH_BATCH_SIZE)) {
            if (connectionError) throw connectionError;
            phase = 'fetch';
            const fetchStartedAt = Date.now();
            logger.info('[IMAP] Étape démarrée', { pollCycleId, step: 'fetch', uidCount: uidBatch.length });
            const messages = await client.fetchAll(uidBatch, { uid: true, source: true }, { uid: true });
            logger.info('[IMAP] Étape terminée', {
                pollCycleId, step: 'fetch', uidCount: uidBatch.length, messageCount: messages.length,
                durationMs: Date.now() - fetchStartedAt,
            });

            phase = 'process';
            const pendingSeen = [];
            for (const message of messages) {
                const context = { pollCycleId, mailIndex: ++mailIndex, uid: message.uid };
                try {
                    const outcome = await processFetchedMessage(message, context);
                    if (outcome.status === 'imported') stats.imported++;
                    if (outcome.status !== 'imported') stats.skipped++;
                    if (outcome.markSeen) pendingSeen.push(context);
                } catch (error) {
                    if (isImapConnectionError(error) || connectionError) throw connectionError || error;
                    stats.errors++;
                    logger.error('[IMAP] Erreur métier email', { ...context, error: error.message, code: error.code });
                }
            }

            // Tous les FETCH du batch sont terminés ; STORE peut maintenant être envoyé sans deadlock.
            phase = 'mark_seen';
            for (const context of pendingSeen) {
                if (connectionError) throw connectionError;
                await runEmailStep(context, 'mark_seen', () => client.messageFlagsAdd(context.uid, ['\\Seen'], { uid: true }));
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
