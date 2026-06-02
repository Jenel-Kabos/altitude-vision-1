// server/services/zohoImapService.js
// ============================================================
// 📬 Service IMAP — Récupère les emails entrants depuis Zoho
// Utilise imapflow (moderne, sans vulnérabilités connues)
// ============================================================
const { ImapFlow }     = require('imapflow');
const { simpleParser } = require('mailparser');
const InternalMail = require('../models/InternalMail');
const User         = require('../models/User');

// ── Fonction principale ───────────────────────────────────────
const pollZohoInbox = async () => {
    console.log('📬 [IMAP] Démarrage du polling Zoho...');

    if (!process.env.ZOHO_FROM_EMAIL || !process.env.ZOHO_IMAP_PASSWORD) {
        console.warn('⚠️ [IMAP] ZOHO_FROM_EMAIL ou ZOHO_IMAP_PASSWORD non configurés — polling ignoré');
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
        console.error('❌ [IMAP] Erreur socket (absorbée):', err.message);
    });

    try {
        // 1. Connexion
        await client.connect();
        console.log('✅ [IMAP] Connexion Zoho établie');

        // 2. Ouvrir INBOX
        const lock = await client.getMailboxLock('INBOX');

        try {
            // 3. Chercher les emails non lus
            const uids = await client.search({ seen: false });
            console.log(`📨 [IMAP] ${uids.length} email(s) non lu(s) trouvé(s)`);

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

                    console.log(`  📧 [IMAP] "${subject}" — de: ${fromAddress}`);

                    // 5. Éviter les doublons
                    const existing = await InternalMail.findOne({ zohoMessageId: messageId });
                    if (existing) {
                        console.log(`  ℹ️  [IMAP] Doublon ignoré: ${messageId}`);
                        stats.skipped++;
                        await client.messageFlagsAdd({ uid: message.uid }, ['\\Seen']);
                        continue;
                    }

                    // 6. Trouver le destinataire interne
                    let recipientUser = await User.findOne({ email: toAddress });
                    if (!recipientUser) {
                        console.warn(`  ⚠️  [IMAP] ${toAddress} inconnu → recherche admin`);
                        recipientUser = await User.findOne({ role: 'Admin', isActive: true });
                    }
                    if (!recipientUser) {
                        console.warn(`  ❌ [IMAP] Aucun destinataire — email ignoré`);
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
                    });

                    // 8. Marquer comme lu dans Zoho
                    await client.messageFlagsAdd({ uid: message.uid }, ['\\Seen']);

                    console.log(`  ✅ [IMAP] Importé pour ${recipientUser.email} : "${subject}"`);
                    stats.imported++;

                } catch (msgErr) {
                    console.error(`  ❌ [IMAP] Erreur message:`, msgErr.message);
                    stats.errors++;
                }
            }

        } finally {
            lock.release();
        }

        await client.logout();
        console.log(`📬 [IMAP] Terminé — importés: ${stats.imported}, ignorés: ${stats.skipped}, erreurs: ${stats.errors}`);
        return stats;

    } catch (error) {
        const isNetworkErr = ['ETIMEOUT', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT'].includes(error.code);
        if (isNetworkErr) {
            console.warn(`⚠️ [IMAP] Timeout/réseau (${error.code}) — polling ignoré, serveur intact`);
        } else {
            console.error('❌ [IMAP] Erreur connexion:', error.message);
        }
        try { client.close(); } catch {}
        return { ...stats, errors: stats.errors + 1 };
    }
};

module.exports = { pollZohoInbox };