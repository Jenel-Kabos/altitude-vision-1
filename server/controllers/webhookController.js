// server/controllers/webhookController.js
const crypto       = require('crypto');
const InternalMail = require('../models/InternalMail');
const User         = require('../models/User');

// ============================================================
// POST /api/webhooks/zoho-incoming
// Reçoit les emails entrants de Zoho et les insère en BDD
// ============================================================
const handleZohoIncoming = async (req, res) => {
    try {

        // ── 1. Vérification signature HMAC (sécurité) ────────────
        const secret    = process.env.ZOHO_WEBHOOK_SECRET;
        const signature = req.headers['x-zoho-signature'] || req.headers['x-webhook-signature'];

        if (secret && signature) {
            const expected = `sha256=${crypto
                .createHmac('sha256', secret)
                .update(JSON.stringify(req.body))
                .digest('hex')}`;

            if (signature !== expected) {
                console.warn('⚠️ [Webhook] Signature invalide — requête rejetée');
                return res.status(401).json({ status: 'fail', message: 'Signature invalide.' });
            }
        } else if (secret && !signature) {
            // Secret configuré mais pas de signature reçue → rejeter en prod
            if (process.env.NODE_ENV === 'production') {
                console.warn('⚠️ [Webhook] Signature absente en production — requête rejetée');
                return res.status(401).json({ status: 'fail', message: 'Signature manquante.' });
            }
        }

        // ── 2. Extraire les données de l'email ───────────────────
        // Zoho peut envoyer les champs dans différents formats selon
        // la configuration du webhook (REST API v1 ou v2).
        // On gère les deux variantes ici.
        const fromAddress = req.body.fromAddress  || req.body.from_address || req.body.from;
        const fromName    = req.body.fromName     || req.body.from_name    || req.body.senderName || '';
        const toAddress   = req.body.toAddress    || req.body.to_address   || req.body.to;
        const subject     = req.body.subject      || '(Sans objet)';
        const textContent = req.body.textContent  || req.body.text_content || req.body.body_text || '';
        const htmlContent = req.body.htmlContent  || req.body.html_content || req.body.body_html || '';
        const messageId   = req.body.messageId    || req.body.message_id   || req.body.zohoMessageId || null;

        console.log(`📨 [Webhook] Email entrant de: ${fromAddress} → ${toAddress}`);

        if (!fromAddress || !toAddress) {
            console.warn('⚠️ [Webhook] Champs from/to manquants dans le body');
            return res.status(400).json({ status: 'fail', message: 'Champs from/to manquants.' });
        }

        // ── 3. Éviter les doublons ────────────────────────────────
        if (messageId) {
            const existing = await InternalMail.findOne({ zohoMessageId: messageId });
            if (existing) {
                console.log(`ℹ️ [Webhook] Email déjà reçu (${messageId}) — ignoré`);
                return res.status(200).json({ status: 'ignored', message: 'Email déjà reçu.' });
            }
        }

        // ── 4. Trouver le destinataire interne ───────────────────
        // On cherche l'utilisateur qui possède l'adresse toAddress
        const toAddressClean = toAddress.toLowerCase().trim();

        const recipientUser = await User.findOne({
            email: toAddressClean,
        });

        if (!recipientUser) {
            // Aucun compte interne → on cherche un admin par défaut
            const adminUser = await User.findOne({ role: 'Admin', isActive: true });

            if (!adminUser) {
                console.warn(`⚠️ [Webhook] Aucun utilisateur trouvé pour: ${toAddressClean}`);
                // Répondre 200 pour éviter les renvois répétés de Zoho
                return res.status(200).json({ status: 'ignored', message: 'Destinataire inconnu.' });
            }

            console.log(`ℹ️ [Webhook] Adresse ${toAddressClean} inconnue → redirigé vers Admin: ${adminUser.email}`);

            await InternalMail.create({
                sender:         undefined,
                senderName:     fromName    || fromAddress,
                senderEmail:    fromAddress,
                receiverEmail:  toAddressClean,
                receiver:       adminUser._id,
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

            console.log(`✅ [Webhook] Email redirigé vers Admin: ${adminUser.email}`);
            return res.status(200).json({ status: 'success', message: 'Email redirigé vers admin.' });
        }

        // ── 5. Créer le message en boîte de réception ─────────────
        const mail = await InternalMail.create({
            sender:         undefined,          // pas d'ObjectId pour un expéditeur externe
            senderName:     fromName    || fromAddress,
            senderEmail:    fromAddress,
            receiverEmail:  toAddressClean,
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

        console.log(`✅ [Webhook] Email externe sauvegardé → ID: ${mail._id} pour: ${recipientUser.email}`);

        return res.status(200).json({
            status: 'success',
            data:   { messageId: mail._id },
        });

    } catch (error) {
        console.error('❌ [Webhook] Erreur traitement email entrant:', error.message);
        // Répondre 200 pour éviter les renvois répétés de Zoho
        return res.status(200).json({ status: 'error', message: error.message });
    }
};

// ============================================================
// GET /api/webhooks/test
// Route de test pour vérifier que le webhook est accessible
// ============================================================
const testWebhook = (req, res) => {
    res.status(200).json({
        status:  'success',
        message: '🪝 Webhook Zoho opérationnel',
        url:     `${req.protocol}://${req.get('host')}/api/webhooks/zoho-incoming`,
        secret:  process.env.ZOHO_WEBHOOK_SECRET ? '✅ Configuré' : '⚠️ Non configuré',
    });
};

module.exports = { handleZohoIncoming, testWebhook };