const Quote = require('../models/Quote');
const sendEmail = require('../config/email');
const { 
  adminNotificationEmail, 
  clientConfirmationEmail 
} = require('../templates/quoteNotificationTemplate');

// @desc    Créer une nouvelle demande de devis
// @route   POST /api/quotes
// @access  Public
const createQuote = async (req, res, next) => {
    const { clientName, clientEmail, eventType, services, totalPrice } = req.body;

    if (!clientName || !clientEmail || !services || services.length === 0) {
        res.status(400);
        throw new Error('Veuillez remplir tous les champs obligatoires.');
    }

    try {
        const quote = new Quote({
            clientName,
            clientEmail,
            eventType,
            services,
            totalPrice,
        });

        const createdQuote = await quote.save();
        
        // Logique d'envoi d'email
        try {
            await sendEmail({
                to: process.env.CONTACT_EMAIL_TO,
                subject: `[Altitude-Vision] Nouvelle demande de devis de ${createdQuote.clientName}`,
                html: adminNotificationEmail(createdQuote),
            });

            await sendEmail({
                to: createdQuote.clientEmail,
                subject: 'Confirmation de votre demande de devis chez Altitude-Vision',
                html: clientConfirmationEmail(createdQuote),
            });
        } catch (emailError) {
            console.error("Erreur lors de l'envoi des emails :", emailError);
        }

        res.status(201).json(createdQuote);
    } catch (error) {
        next(error);
    }
};

// **VÉRIFIEZ BIEN CETTE LIGNE**
// Elle doit contenir `createQuote` entre les accolades.
module.exports = { createQuote };