// server/controllers/quoteController.js
const QuoteRequest  = require('../models/QuoteRequest');
const { sendEmail } = require('../config/email'); // ✅ Zoho OAuth2

// ======================================================
// 📤 Créer une nouvelle demande de devis (PUBLIC)
// Route: POST /api/quotes
// ======================================================
exports.createQuoteRequest = async (req, res, next) => {
    try {
        const quoteData = req.body;
        const source    = quoteData.source || 'MilaEvents';

        if (req.user && req.user._id) {
            quoteData.user = req.user._id;
        }

        // ── Valeurs par défaut pour Altcom ────────────────────
        if (source === 'Altcom') {
            const errs = [];
            if (!quoteData.name)        errs.push('Le nom est requis.');
            if (!quoteData.email)       errs.push("L'email est requis.");
            if (!quoteData.description) errs.push('La description est requise.');
            if (errs.length > 0) return res.status(400).json({ status: 'fail', message: 'Données invalides.', errors: errs });

            quoteData.eventType = quoteData.eventType || 'Projet Altcom';
            quoteData.guests    = quoteData.guests    || 1;
            quoteData.date      = quoteData.date      || new Date();
            quoteData.service   = quoteData.service   || 'Communication & Branding';
        }

        const newQuote = await QuoteRequest.create(quoteData);

        // ── Email de confirmation au client via Zoho ──────────
        const isAltcom   = source === 'Altcom';
        const brandName  = isAltcom ? 'Altcom' : 'Mila Events';
        const brandColor = isAltcom ? '#f59e0b' : '#2563eb';

        const detailsHTML = isAltcom ? `
            <p><strong>Service :</strong> ${newQuote.service}</p>
            <p><strong>Description :</strong> ${(newQuote.description || '').substring(0, 150)}${(newQuote.description || '').length > 150 ? '…' : ''}</p>
        ` : `
            <p><strong>Date :</strong> ${new Date(newQuote.date).toLocaleDateString('fr-FR')}</p>
            <p><strong>Invités :</strong> ${newQuote.guests} personnes</p>
            <p><strong>Service :</strong> ${newQuote.service}</p>
            <p><strong>Type :</strong> ${newQuote.eventType}</p>
            ${newQuote.budget ? `<p><strong>Budget :</strong> ${newQuote.budget} FCFA</p>` : ''}
        `;

        try {
            await sendEmail({
                to:      newQuote.email,
                subject: isAltcom
                    ? 'Confirmation de votre demande de projet — Altcom'
                    : 'Confirmation de votre demande de devis — Mila Events',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background: ${brandColor}; padding: 28px; border-radius: 12px 12px 0 0; text-align: center;">
                            <h1 style="color: white; margin: 0; font-size: 22px;">${brandName}</h1>
                        </div>
                        <div style="background: #fff; padding: 28px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
                            <h2 style="color: #1f2937;">Demande reçue ✅</h2>
                            <p>Bonjour <strong>${newQuote.name}</strong>,</p>
                            <p>Nous avons bien reçu votre demande pour <strong>${newQuote.service}</strong>.</p>
                            <div style="background: #f8fafc; padding: 16px; border-radius: 8px; border-left: 4px solid ${brandColor}; margin: 20px 0;">
                                ${detailsHTML}
                            </div>
                            <p>Notre équipe vous recontacte sous <strong>24–48h</strong>.</p>
                            <p style="margin-top: 24px;">Cordialement,<br><strong>L'équipe ${brandName}</strong></p>
                            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
                            <p style="font-size: 12px; color: #9ca3af; text-align: center;">
                                Altitude Vision — <a href="https://altitudevision.agency" style="color: #2563eb;">altitudevision.agency</a>
                            </p>
                        </div>
                    </div>
                `,
            });
            console.log('✅ [Quote] Confirmation envoyée à:', newQuote.email);
        } catch (emailErr) {
            // L'email échoue silencieusement — le devis est quand même enregistré
            console.error('❌ [Quote] Erreur envoi confirmation:', emailErr.message);
        }

        res.status(201).json({
            status:  'success',
            message: 'Demande de devis enregistrée avec succès.',
            data:    { quote: newQuote },
        });

    } catch (err) {
        console.error('❌ [Quote] Erreur création:', err);
        if (err.name === 'ValidationError') {
            return res.status(400).json({
                status:  'fail',
                message: 'Données invalides.',
                errors:  Object.values(err.errors).map(e => e.message),
            });
        }
        res.status(500).json({ status: 'error', message: 'Erreur interne du serveur.' });
    }
};

// ======================================================
// 📋 Tous les devis (ADMIN)
// ======================================================
exports.getAllQuotes = async (req, res) => {
    try {
        const queryObj = { ...req.query };
        ['page', 'sort', 'limit', 'fields'].forEach(f => delete queryObj[f]);

        let query = QuoteRequest.find(queryObj);
        query = query.sort(req.query.sort ? req.query.sort.split(',').join(' ') : '-createdAt');

        const page  = parseInt(req.query.page,  10) || 1;
        const limit = parseInt(req.query.limit, 10) || 100;
        query = query.skip((page - 1) * limit).limit(limit);

        const [quotes, total] = await Promise.all([
            query.populate('user', 'name email'),
            QuoteRequest.countDocuments(queryObj),
        ]);

        res.status(200).json({
            status: 'success',
            results: quotes.length,
            pagination: { total, page, pages: Math.ceil(total / limit) },
            data: { quotes },
        });
    } catch (err) {
        console.error('❌ [Quote] getAllQuotes:', err);
        res.status(500).json({ status: 'error', message: 'Erreur récupération des devis.' });
    }
};

// ======================================================
// 🔍 Un devis par ID (ADMIN)
// ======================================================
exports.getQuoteById = async (req, res) => {
    try {
        const quote = await QuoteRequest.findById(req.params.id).populate('user', 'name email');
        if (!quote) return res.status(404).json({ status: 'fail', message: 'Devis introuvable.' });
        res.status(200).json({ status: 'success', data: { quote } });
    } catch (err) {
        console.error('❌ [Quote] getQuoteById:', err);
        res.status(500).json({ status: 'error', message: 'Erreur récupération du devis.' });
    }
};

// ======================================================
// ✏️ Mettre à jour le statut (ADMIN)
// ======================================================
exports.updateQuoteStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const valid = ['Nouveau', 'En cours', 'Devis Envoyé', 'Converti', 'Archivé'];
        if (status && !valid.includes(status))
            return res.status(400).json({ status: 'fail', message: `Statut invalide. Valeurs : ${valid.join(', ')}` });

        const quote = await QuoteRequest.findByIdAndUpdate(
            req.params.id, { status }, { new: true, runValidators: true }
        );
        if (!quote) return res.status(404).json({ status: 'fail', message: 'Devis introuvable.' });

        res.status(200).json({ status: 'success', message: 'Statut mis à jour.', data: { quote } });
    } catch (err) {
        console.error('❌ [Quote] updateQuoteStatus:', err);
        res.status(500).json({ status: 'error', message: 'Erreur mise à jour statut.' });
    }
};

// ======================================================
// 📧 Envoyer une réponse au client (ADMIN)
// ======================================================
exports.sendQuoteResponse = async (req, res) => {
    try {
        const { subject, message, quotedAmount, attachments } = req.body;
        if (!subject || !message || !quotedAmount)
            return res.status(400).json({ status: 'fail', message: 'Sujet, message et montant requis.' });

        const quote = await QuoteRequest.findById(req.params.id);
        if (!quote) return res.status(404).json({ status: 'fail', message: 'Devis introuvable.' });

        const formattedAmount = parseInt(quotedAmount).toLocaleString('fr-FR');
        const isAltcom  = quote.source === 'Altcom';
        const brandName = isAltcom ? 'Altcom' : 'Mila Events';
        const brandColor = isAltcom ? '#f59e0b' : '#2563eb';

        const detailsHTML = isAltcom ? `
            <div style="background:#fffbeb;padding:16px;border-radius:8px;border-left:4px solid #f59e0b;margin:20px 0;">
                <p><strong>Service :</strong> ${quote.service}</p>
                <p><strong>Description :</strong> ${(quote.description || '').substring(0, 150)}…</p>
            </div>
        ` : `
            <div style="background:#eff6ff;padding:16px;border-radius:8px;border-left:4px solid #2563eb;margin:20px 0;">
                <p><strong>Service :</strong> ${quote.service}</p>
                <p><strong>Type :</strong> ${quote.eventType}</p>
                <p><strong>Date :</strong> ${new Date(quote.date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                <p><strong>Invités :</strong> ${quote.guests} personnes</p>
            </div>
        `;

        await sendEmail({
            to:      quote.email,
            subject,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: ${brandColor}; padding: 28px; border-radius: 12px 12px 0 0; text-align: center;">
                        <h1 style="color: white; margin: 0;">${brandName}</h1>
                        <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0;">Votre devis personnalisé</p>
                    </div>
                    <div style="background: #fff; padding: 28px; border: 1px solid #e5e7eb; border-top: none;">
                        <p>Bonjour <strong>${quote.name}</strong>,</p>
                        <p style="white-space: pre-wrap;">${message}</p>
                        <div style="background: linear-gradient(135deg,#fef3c7,#fde68a);padding:24px;border-radius:10px;margin:28px 0;text-align:center;">
                            <p style="margin:0;color:#92400e;font-size:13px;font-weight:600;">MONTANT DU DEVIS</p>
                            <h2 style="margin:8px 0 0;color:#78350f;font-size:34px;">${formattedAmount} FCFA</h2>
                        </div>
                        ${detailsHTML}
                        <p>Pour confirmer ou poser une question, contactez-nous directement.</p>
                        <p style="margin-top:24px;">Cordialement,<br><strong>L'équipe ${brandName}</strong></p>
                    </div>
                    <div style="background:#f9fafb;padding:16px;text-align:center;border-radius:0 0 12px 12px;">
                        <p style="margin:0;font-size:12px;color:#6b7280;">
                            📞 ${process.env.COMPANY_PHONE || '+242 06 800 21 51'} &nbsp;|&nbsp;
                            🌐 <a href="https://altitudevision.agency" style="color:#2563eb;">altitudevision.agency</a>
                        </p>
                    </div>
                </div>
            `,
        });

        quote.status = 'Devis Envoyé';
        await quote.save();

        res.status(200).json({ status: 'success', message: 'Devis envoyé au client.', data: { quote } });
    } catch (err) {
        console.error('❌ [Quote] sendQuoteResponse:', err);
        res.status(500).json({ status: 'error', message: "Erreur lors de l'envoi du devis." });
    }
};

// ======================================================
// 🗑️ Supprimer un devis (ADMIN)
// ======================================================
exports.deleteQuote = async (req, res) => {
    try {
        const quote = await QuoteRequest.findByIdAndDelete(req.params.id);
        if (!quote) return res.status(404).json({ status: 'fail', message: 'Devis introuvable.' });
        res.status(204).json({ status: 'success', data: null });
    } catch (err) {
        console.error('❌ [Quote] deleteQuote:', err);
        res.status(500).json({ status: 'error', message: 'Erreur suppression.' });
    }
};

// ======================================================
// 📊 Statistiques (ADMIN)
// ======================================================
exports.getQuoteStats = async (req, res) => {
    try {
        const [stats, total, converted] = await Promise.all([
            QuoteRequest.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
            QuoteRequest.countDocuments(),
            QuoteRequest.countDocuments({ status: 'Converti' }),
        ]);

        res.status(200).json({
            status: 'success',
            data: {
                total,
                converted,
                conversionRate: total > 0 ? `${((converted / total) * 100).toFixed(2)}%` : '0%',
                byStatus: stats,
            },
        });
    } catch (err) {
        console.error('❌ [Quote] getQuoteStats:', err);
        res.status(500).json({ status: 'error', message: 'Erreur statistiques.' });
    }
};