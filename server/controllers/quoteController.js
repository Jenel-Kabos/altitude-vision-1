// server/controllers/quoteController.js
const QuoteRequest = require('../models/QuoteRequest');
const nodemailer = require('nodemailer');

// ======================================================
// 📧 Configuration Nodemailer (Email)
// ======================================================
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false, // true pour 465, false pour les autres ports
    auth: {
        user: process.env.EMAIL_USER, // Votre email
        pass: process.env.EMAIL_PASSWORD, // Mot de passe d'application
    },
});

// Vérifier la configuration email au démarrage (OPTIONNEL)
if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
    transporter.verify((error, success) => {
        if (error) {
            console.error('❌ [Email] Erreur de configuration:', error.message);
            console.warn('⚠️ [Email] Les emails ne pourront pas être envoyés. Configurez EMAIL_USER et EMAIL_PASSWORD dans .env');
        } else {
            console.log('✅ [Email] Configuration prête pour l\'envoi');
        }
    });
} else {
    console.warn('⚠️ [Email] Configuration email non définie. Les demandes de devis fonctionneront mais sans email.');
}

// ======================================================
// 📤 Créer une nouvelle demande de devis (PUBLIC)
// Route: POST /api/v1/quotes
// ======================================================
exports.createQuoteRequest = async (req, res, next) => {
    try {
        const quoteData = req.body;
        // Déterminer la source: 'Altcom' ou 'MilaEvents' par défaut
        const source = quoteData.source || 'MilaEvents'; 

        // Lier à l'utilisateur si authentifié
        if (req.user && req.user._id) {
            quoteData.user = req.user._id;
        }

        // ⭐ CORRECTION CLÉ POUR ALTCOM ⭐
        if (source === 'Altcom') {
            // 1. Validation minimale pour Altcom
            const altcomErrors = [];
            if (!quoteData.name) altcomErrors.push("Le nom est requis.");
            if (!quoteData.email) altcomErrors.push("L'email est requis.");
            if (!quoteData.description) altcomErrors.push("La description du projet est requise.");

            if (altcomErrors.length > 0) {
                 return res.status(400).json({
                    status: 'fail',
                    message: 'Données de projet Altcom invalides.',
                    errors: altcomErrors,
                 });
            }

            // 2. Ajout des valeurs par défaut pour satisfaire le schéma Mongoose (qui est axé sur les événements)
            quoteData.eventType = quoteData.eventType || 'Projet Altcom'; 
            quoteData.guests = quoteData.guests || 1; 
            quoteData.date = quoteData.date || new Date(); 
            quoteData.service = quoteData.service || 'Communication & Branding';
        }
        // Fin de la correction ⭐

        // Tentative de création du devis (la validation Mongoose s'applique ici)
        const newQuote = await QuoteRequest.create(quoteData);

        // ======================================================
        // 📧 Logique d'envoi d'email (Adaptée à la source)
        // ======================================================
        
        const isAltcom = source === 'Altcom';
        const brandName = isAltcom ? 'Altcom' : 'Mila Events';
        const emailSubject = isAltcom
            ? 'Confirmation de votre demande de projet - Altcom'
            : 'Confirmation de votre demande de devis - Mila Events';

        // Contenu HTML spécifique à la source
        const eventDetailsHTML = isAltcom ? `
            <h3 style="margin-top: 0; color: #f59e0b;">Récapitulatif de votre demande :</h3>
            <ul style="list-style: none; padding: 0;">
                <li>🎯 <strong>Service :</strong> ${newQuote.service}</li>
                <li>📝 <strong>Description :</strong> ${newQuote.description.substring(0, 150)}${newQuote.description.length > 150 ? '...' : ''}</li>
            </ul>
        ` : `
            <h3 style="margin-top: 0; color: #2563eb;">Récapitulatif de votre événement :</h3>
            <ul style="list-style: none; padding: 0;">
                <li>📅 <strong>Date :</strong> ${new Date(newQuote.date).toLocaleDateString('fr-FR')}</li>
                <li>👥 <strong>Invités :</strong> ${newQuote.guests} personnes</li>
                <li>🎯 <strong>Service :</strong> ${newQuote.service}</li>
                <li>🎉 <strong>Type :</strong> ${newQuote.eventType}</li>
                ${newQuote.budget ? `<li>💰 <strong>Budget :</strong> ${newQuote.budget} FCFA</li>` : ''}
            </ul>
        `;
        
        try {
            await transporter.sendMail({
                from: `"${brandName}" <${process.env.EMAIL_USER}>`,
                to: newQuote.email,
                subject: emailSubject,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: ${isAltcom ? '#f59e0b' : '#2563eb'};">Demande ${isAltcom ? 'de Projet' : 'de Devis'} Reçue ✓</h2>
                        <p>Bonjour <strong>${newQuote.name}</strong>,</p>
                        <p>Nous avons bien reçu votre demande pour votre projet de <strong>${newQuote.service}</strong>.</p>
                        
                        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            ${eventDetailsHTML}
                        </div>
                        
                        <p>Notre équipe va étudier votre demande et vous reviendra sous <strong>24-48 heures</strong> avec une proposition détaillée.</p>
                        
                        <p>Si vous avez des questions, n'hésitez pas à nous contacter.</p>
                        
                        <p style="margin-top: 30px;">Cordialement,<br><strong>L'équipe ${brandName}</strong></p>
                        
                        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                        <p style="font-size: 12px; color: #6b7280;">
                            Cet email a été envoyé automatiquement, merci de ne pas y répondre directement.
                        </p>
                    </div>
                `,
            });
            console.log('✅ [Email] Confirmation envoyée à:', newQuote.email);
        } catch (emailError) {
            console.error('❌ [Email] Erreur d\'envoi de confirmation:', emailError);
        }

        res.status(201).json({
            status: 'success',
            message: 'Demande de devis enregistrée avec succès.',
            data: {
                quote: newQuote,
            },
        });

    } catch (err) {
        console.error('❌ [Quote] Erreur lors de la création du devis:', err);
        
        if (err.name === 'ValidationError') {
            const errors = Object.values(err.errors).map(el => el.message);
            // Retourne les erreurs de validation Mongoose
            return res.status(400).json({
                status: 'fail',
                message: 'Données de devis invalides.',
                errors: errors,
            });
        }

        res.status(500).json({
            status: 'error',
            message: 'Une erreur interne du serveur est survenue.',
        });
    }
};

// ======================================================
// 📋 Récupérer tous les devis (ADMIN/COLLABORATEUR)
// Route: GET /api/v1/quotes
// ======================================================
exports.getAllQuotes = async (req, res) => {
    try {
        // Filtres optionnels
        const queryObj = { ...req.query };
        const excludedFields = ['page', 'sort', 'limit', 'fields'];
        excludedFields.forEach(el => delete queryObj[el]);

        // Filtrage avancé (ex: status=Nouveau)
        let query = QuoteRequest.find(queryObj);

        // Tri
        if (req.query.sort) {
            const sortBy = req.query.sort.split(',').join(' ');
            query = query.sort(sortBy);
        } else {
            query = query.sort('-createdAt'); // Plus récent en premier
        }

        // Pagination
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 100;
        const skip = (page - 1) * limit;
        query = query.skip(skip).limit(limit);

        // Exécution de la requête
        const quotes = await query.populate('user', 'name email');
        const total = await QuoteRequest.countDocuments(queryObj);

        res.status(200).json({
            status: 'success',
            results: quotes.length,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit),
            },
            data: {
                quotes,
            },
        });

    } catch (err) {
        console.error('❌ [Quote] Erreur lors de la récupération des devis:', err);
        res.status(500).json({
            status: 'error',
            message: 'Erreur lors de la récupération des devis.',
        });
    }
};

// ======================================================
// 🔍 Récupérer un devis par ID (ADMIN/COLLABORATEUR)
// Route: GET /api/v1/quotes/:id
// ======================================================
exports.getQuoteById = async (req, res) => {
    try {
        const quote = await QuoteRequest.findById(req.params.id).populate('user', 'name email');

        if (!quote) {
            return res.status(404).json({
                status: 'fail',
                message: 'Devis introuvable',
            });
        }

        res.status(200).json({
            status: 'success',
            data: {
                quote,
            },
        });

    } catch (err) {
        console.error('❌ [Quote] Erreur lors de la récupération du devis:', err);
        res.status(500).json({
            status: 'error',
            message: 'Erreur lors de la récupération du devis.',
        });
    }
};

// ======================================================
// ✏️ Mettre à jour le statut d'un devis (ADMIN/COLLABORATEUR)
// Route: PATCH /api/v1/quotes/:id
// ======================================================
exports.updateQuoteStatus = async (req, res) => {
    try {
        const { status } = req.body;

        // Validation du statut
        const validStatuses = ['Nouveau', 'En cours', 'Devis Envoyé', 'Converti', 'Archivé'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({
                status: 'fail',
                message: `Statut invalide. Valeurs autorisées : ${validStatuses.join(', ')}`,
            });
        }

        const quote = await QuoteRequest.findByIdAndUpdate(
            req.params.id,
            { status },
            {
                new: true,
                runValidators: true,
            }
        );

        if (!quote) {
            return res.status(404).json({
                status: 'fail',
                message: 'Devis introuvable',
            });
        }

        console.log(`✅ [Quote] Statut mis à jour pour le devis ${req.params.id} : ${status}`);

        res.status(200).json({
            status: 'success',
            message: 'Statut mis à jour avec succès',
            data: {
                quote,
            },
        });

    } catch (err) {
        console.error('❌ [Quote] Erreur lors de la mise à jour du statut:', err);
        res.status(500).json({
            status: 'error',
            message: 'Erreur lors de la mise à jour du statut.',
        });
    }
};

// ======================================================
// 📧 Envoyer une réponse de devis au client (ADMIN/COLLABORATEUR)
// Route: POST /api/v1/quotes/:id/respond
// ======================================================
exports.sendQuoteResponse = async (req, res) => {
    try {
        const { subject, message, quotedAmount, attachments } = req.body;

        // Validation
        if (!subject || !message || !quotedAmount) {
            return res.status(400).json({
                status: 'fail',
                message: 'Sujet, message et montant du devis sont requis.',
            });
        }

        // Récupérer le devis
        const quote = await QuoteRequest.findById(req.params.id);
        if (!quote) {
            return res.status(404).json({
                status: 'fail',
                message: 'Devis introuvable',
            });
        }

        // Formater le montant
        const formattedAmount = parseInt(quotedAmount).toLocaleString('fr-FR');
        
        const isAltcom = quote.source === 'Altcom';
        const brandName = isAltcom ? 'Altcom' : 'Mila Events';

        // Contenu HTML spécifique à la source
        const eventDetailsHTML = isAltcom ? `
            <div style="background-color: #fffbeb; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #92400e;">Détails du projet :</h3>
                <ul style="list-style: none; padding: 0; margin: 0;">
                    <li style="padding: 5px 0;">🎯 <strong>Service :</strong> ${quote.service}</li>
                    <li style="padding: 5px 0;">📝 <strong>Description :</strong> ${quote.description.substring(0, 150)}${quote.description.length > 150 ? '...' : ''}</li>
                    <li style="padding: 5px 0;">📅 <strong>Date d'enregistrement :</strong> ${new Date(quote.createdAt).toLocaleDateString('fr-FR')}</li>
                </ul>
            </div>
        ` : `
            <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; border-left: 4px solid #2563eb; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #1e40af;">Récapitulatif de votre événement :</h3>
                <ul style="list-style: none; padding: 0; margin: 0;">
                    <li style="padding: 5px 0;">🎯 <strong>Service :</strong> ${quote.service}</li>
                    <li style="padding: 5px 0;">🎉 <strong>Type :</strong> ${quote.eventType}</li>
                    <li style="padding: 5px 0;">📅 <strong>Date :</strong> ${new Date(quote.date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</li>
                    <li style="padding: 5px 0;">👥 <strong>Invités :</strong> ${quote.guests} personnes</li>
                </ul>
            </div>
        `;

        // 📧 Envoyer l'email au client
        const mailOptions = {
            from: `"${brandName} - Devis" <${process.env.EMAIL_USER}>`,
            to: quote.email,
            subject: subject,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, ${isAltcom ? '#f59e0b' : '#2563eb'} 0%, ${isAltcom ? '#b45309' : '#1e40af'} 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h1 style="color: white; margin: 0;">${brandName}</h1>
                        <p style="color: ${isAltcom ? '#fcd34d' : '#dbeafe'}; margin: 10px 0 0 0;">Votre Devis Personnalisé</p>
                    </div>
                    
                    <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
                        <p>Bonjour <strong>${quote.name}</strong>,</p>
                        
                        <p style="white-space: pre-wrap;">${message}</p>
                        
                        <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 25px; border-radius: 10px; margin: 30px 0; text-align: center;">
                            <p style="margin: 0; color: #92400e; font-size: 14px; font-weight: 600;">MONTANT DU DEVIS</p>
                            <h2 style="margin: 10px 0 0 0; color: #78350f; font-size: 36px;">${formattedAmount} FCFA</h2>
                        </div>
                        
                        ${eventDetailsHTML}
                        
                        <p style="margin-top: 30px;">Pour toute question ou pour confirmer votre réservation, n'hésitez pas à nous contacter directement.</p>
                        
                        <p style="margin-top: 30px;">Cordialement,<br><strong>L'équipe ${brandName}</strong></p>
                    </div>
                    
                    <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 10px 10px;">
                        <p style="margin: 0; font-size: 12px; color: #6b7280;">
                            📞 Contact : ${process.env.COMPANY_PHONE || 'XXX-XXX-XXX'}<br>
                            📧 Email : ${process.env.EMAIL_USER}
                        </p>
                    </div>
                </div>
            `,
        };

        // Ajouter des pièces jointes si fournies
        if (attachments && attachments.length > 0) {
            mailOptions.attachments = attachments;
        }

        await transporter.sendMail(mailOptions);

        // Mettre à jour le statut du devis
        quote.status = 'Devis Envoyé';
        await quote.save();

        console.log(`✅ [Email] Devis envoyé avec succès à ${quote.email}`);

        res.status(200).json({
            status: 'success',
            message: 'Devis envoyé avec succès au client',
            data: {
                quote,
            },
        });

    } catch (err) {
        console.error('❌ [Quote] Erreur lors de l\'envoi du devis:', err);
        res.status(500).json({
            status: 'error',
            message: 'Erreur lors de l\'envoi du devis.',
        });
    }
};

// ======================================================
// 🗑️ Supprimer un devis (ADMIN uniquement)
// Route: DELETE /api/v1/quotes/:id
// ======================================================
exports.deleteQuote = async (req, res) => {
    try {
        const quote = await QuoteRequest.findByIdAndDelete(req.params.id);

        if (!quote) {
            return res.status(404).json({
                status: 'fail',
                message: 'Devis introuvable',
            });
        }

        console.log(`✅ [Quote] Devis supprimé : ${req.params.id}`);

        res.status(204).json({
            status: 'success',
            data: null,
        });

    } catch (err) {
        console.error('❌ [Quote] Erreur lors de la suppression du devis:', err);
        res.status(500).json({
            status: 'error',
            message: 'Erreur lors de la suppression du devis.',
        });
    }
};

// ======================================================
// 📊 Statistiques des devis (ADMIN/COLLABORATEUR)
// Route: GET /api/v1/quotes/stats
// ======================================================
exports.getQuoteStats = async (req, res) => {
    try {
        const stats = await QuoteRequest.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                },
            },
        ]);

        const total = await QuoteRequest.countDocuments();
        const converted = await QuoteRequest.countDocuments({ status: 'Converti' });
        const conversionRate = total > 0 ? ((converted / total) * 100).toFixed(2) : 0;

        res.status(200).json({
            status: 'success',
            data: {
                total,
                converted,
                conversionRate: `${conversionRate}%`,
                byStatus: stats,
            },
        });

    } catch (err) {
        console.error('❌ [Quote] Erreur lors du calcul des statistiques:', err);
        res.status(500).json({
            status: 'error',
            message: 'Erreur lors du calcul des statistiques.',
        });
    }
};