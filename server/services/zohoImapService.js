// server/services/zohoImapService.js
// ============================================================
// 📬 Service IMAP — Récupère les emails entrants depuis Zoho
// Utilise imapflow (moderne, sans vulnérabilités connues)
// ============================================================
const { ImapFlow }          = require('imapflow');
const { simpleParser }      = require('mailparser');
const InternalMail          = require('../models/InternalMail');
const User                  = require('../models/User');
const ImapSyncCheckpoint    = require('../models/ImapSyncCheckpoint');
const { uploadPrivateAsset } = require('./storage/secureStorageService');
const logger                = require('../utils/logger');

let isPolling = false;
let pollSequence = 0;
const LOGOUT_TIMEOUT_MS = 5000;
const FETCH_BATCH_SIZE = 10;
const SYNC_MAILBOX = 'INBOX';

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

// HOTFIX-ZOHO-IMAP-SEEN-CHECKPOINT-1 — `\Seen` est un état de lecture Zoho,
// jamais un curseur de synchronisation Altitude Vision (voir
// ZOHO_INBOX_HEALTHCHECK1_ROOT_CAUSE.md : un message marqué lu par
// n'importe quel autre client IMAP/webmail avant notre premier passage
// devenait invisible pour `search({seen:false})`, donc jamais importé,
// silencieusement et définitivement).
//
// Détermine la portée de recherche IMAP à partir du dernier checkpoint
// connu : mailbox + UIDVALIDITY + lastProcessedUid. Trois cas :
//  - aucun checkpoint (premier démarrage) → réexamen complet de la boîte
//    (`{ all: true }`), l'idempotence par `zohoMessageId` (voir
//    `processFetchedMessage`) empêche toute réimportation en double —
//    voir HOTFIX_ZOHO_IMAP_SEEN_CHECKPOINT1_BOOTSTRAP_STRATEGY.md pour la
//    preuve que ce choix est sûr sur ce projet (113 messages au total,
//    fenêtre de test le confirme) ;
//  - `UIDVALIDITY` a changé depuis le dernier checkpoint (mailbox
//    recréée/renumérotée côté serveur) → les anciens UID ne signifient
//    plus rien, reset contrôlé identique au cas "aucun checkpoint" (option
//    A documentée dans HOTFIX_ZOHO_IMAP_SEEN_CHECKPOINT1_UIDVALIDITY_MATRIX.md) ;
//  - même `UIDVALIDITY` → recherche incrémentale stricte `UID > lastProcessedUid`.
const resolveSyncOrigin = (checkpointDoc, currentUidValidity) => {
    if (!checkpointDoc) {
        return { searchCriteria: { all: true }, baseUid: 0, isReset: true, resetReason: 'no_checkpoint' };
    }
    if (String(checkpointDoc.uidValidity) !== String(currentUidValidity)) {
        return { searchCriteria: { all: true }, baseUid: 0, isReset: true, resetReason: 'uidvalidity_changed' };
    }
    const baseUid = checkpointDoc.lastProcessedUid || 0;
    return { searchCriteria: { uid: `${baseUid + 1}:*` }, baseUid, isReset: false, resetReason: null };
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
    // INBOX-PRO-1 — tronquer défensivement AVANT persistance : un email
    // dépassant `maxlength` (content: 10000, html: 200000) ferait échouer
    // toute la validation Mongoose, donc rejeter l'import entier d'un
    // email par ailleurs légitime — un email tronqué reste consultable,
    // un email jamais importé ne l'est pas.
    const textContent = (parsed.text || '').slice(0, 10000);
    const htmlContent = (parsed.html || '').slice(0, 200000);
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

    // INBOX-PRO-1 — `simpleParser` génère quasi systématiquement un
    // `textContent` auto-dérivé même pour un email HTML pur : préférer
    // `textContent` ici privait `content` de toute correspondance HTML
    // réelle (facture/newsletter/tableaux/images), le HTML original
    // n'étant jamais persisté nulle part. `html` conserve désormais le
    // corps HTML original tel que reçu (rendu par le frontend via un
    // viewer sandboxé) ; `content` reste le texte (fallback, recherche,
    // notifications) — jamais supprimé.
    await runEmailStep(context, 'persist', () => InternalMail.create({
        sender: undefined,
        senderName: fromName,
        senderEmail: fromAddress,
        receiverEmail: toAddress,
        receiver: recipientUser._id,
        subject,
        content: (textContent || htmlContent || '(Contenu vide)').slice(0, 10000),
        html: htmlContent || null,
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
    // HOTFIX-ZOHO-IMAP-SEEN-CHECKPOINT-1 — curseur de synchronisation,
    // indépendant du flag `\Seen`. `checkpointAdvanceUid` n'avance que pour
    // les UID traités CONTIGUMENT avec succès depuis `checkpointBaseUid` ;
    // dès qu'un message échoue (erreur métier), `checkpointStalled` bloque
    // toute avancée ultérieure pour ce cycle — les messages après le point
    // de blocage restent traités (résilience existante préservée) mais
    // seront réexaminés au prochain cycle, protégés par la déduplication
    // `zohoMessageId` existante (jamais de doublon, jamais de perte
    // silencieuse — voir HOTFIX_ZOHO_IMAP_SEEN_CHECKPOINT1_IDEMPOTENCE_MATRIX.md).
    let checkpointBaseUid = 0;
    let checkpointAdvanceUid = 0;
    let checkpointStalled = false;
    let checkpointUidValidity = null;
    let checkpointIsReset = false;
    let checkpointResetReason = null;

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
        lock = await client.getMailboxLock(SYNC_MAILBOX);
        logger.info('[IMAP] Mailbox ouverte', { pollCycleId, mailbox: SYNC_MAILBOX });

        // 3. Résoudre le checkpoint de synchronisation (mailbox + UIDVALIDITY
        // + lastProcessedUid) — remplace `search({ seen: false })`. `\Seen`
        // est un état de lecture Zoho, jamais notre curseur d'ingestion (voir
        // ZOHO_INBOX_HEALTHCHECK1_ROOT_CAUSE.md).
        phase = 'checkpoint_load';
        checkpointUidValidity = String(client.mailbox.uidValidity);
        const account = process.env.ZOHO_FROM_EMAIL;
        const checkpointDoc = await runEmailStep(
            { pollCycleId }, 'checkpoint_load',
            () => ImapSyncCheckpoint.findOne({ account, mailbox: SYNC_MAILBOX }),
        );
        const origin = resolveSyncOrigin(checkpointDoc, checkpointUidValidity);
        checkpointBaseUid = origin.baseUid;
        checkpointAdvanceUid = origin.baseUid;
        checkpointIsReset = origin.isReset;
        checkpointResetReason = origin.resetReason;
        if (checkpointIsReset) {
            logger.warn('[IMAP] Réinitialisation du checkpoint de synchronisation', {
                pollCycleId, reason: checkpointResetReason,
                previousUidValidity: checkpointDoc?.uidValidity ?? null, currentUidValidity: checkpointUidValidity,
            });
        }

        // 4. Chercher les messages nouveaux pour Altitude Vision (jamais basé sur `\Seen`)
        phase = 'search';
        const uids = (await client.search(origin.searchCriteria)).sort((a, b) => a - b);
        logger.info('[IMAP] Messages à examiner', {
            pollCycleId, mailCount: uids.length, checkpointBaseUid, isReset: checkpointIsReset,
        });

        // 5. FETCH est terminé avant toute commande IMAP suivante.
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
                    // Le checkpoint n'avance que de façon contiguë : dès
                    // qu'un message a échoué (ci-dessous), plus aucun UID
                    // suivant ne fait avancer le curseur pour ce cycle,
                    // même si son propre traitement réussit.
                    if (!checkpointStalled) checkpointAdvanceUid = Math.max(checkpointAdvanceUid, message.uid);
                } catch (error) {
                    if (isImapConnectionError(error) || connectionError) throw connectionError || error;
                    stats.errors++;
                    checkpointStalled = true;
                    logger.error('[IMAP] Erreur métier email — checkpoint bloqué à cet UID pour reprise au prochain cycle', {
                        ...context, error: error.message, code: error.code, checkpointStalledAtUid: message.uid,
                    });
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

        // HOTFIX-ZOHO-IMAP-SEEN-CHECKPOINT-1 — persistance du checkpoint,
        // indépendante de l'état de la connexion IMAP (une déconnexion
        // réseau en cours de cycle ne doit pas empêcher de conserver la
        // progression déjà faite en toute sécurité). N'écrit que si la
        // mailbox a réellement été ouverte (checkpointUidValidity non nul)
        // et si un reset (premier démarrage/UIDVALIDITY changé) a eu lieu
        // OU si le curseur a réellement avancé — jamais de régression, et
        // jamais un cycle vide n'écrase inutilement le checkpoint existant.
        if (checkpointUidValidity !== null && (checkpointIsReset || checkpointAdvanceUid > checkpointBaseUid)) {
            try {
                await ImapSyncCheckpoint.findOneAndUpdate(
                    { account: process.env.ZOHO_FROM_EMAIL, mailbox: SYNC_MAILBOX },
                    { uidValidity: checkpointUidValidity, lastProcessedUid: checkpointAdvanceUid },
                    { upsert: true },
                );
                logger.info('[IMAP] Checkpoint avancé', {
                    pollCycleId, uidValidity: checkpointUidValidity,
                    fromUid: checkpointBaseUid, toUid: checkpointAdvanceUid, wasReset: checkpointIsReset,
                });
            } catch (error) {
                logger.error('[IMAP] Échec de persistance du checkpoint — le prochain cycle réexaminera cette plage', {
                    pollCycleId, error: error.message,
                });
                stats.errors++;
            }
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

module.exports = { pollZohoInbox, resolveSyncOrigin };
