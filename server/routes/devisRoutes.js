// server/routes/devisRoutes.js
const express    = require('express');
const router     = express.Router();
const sendEmail  = require('../utils/email');
const Devis      = require('../models/Devis');
const auth       = require('../controllers/authController');

const staffOnly = [auth.protect, auth.restrictTo('Admin', 'Collaborateur')];

// ── Template email interne (reçu par l'agence) ───────────────
const getDevisEmailTemplate = (data) => `
<div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #047857, #10B981); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 22px;">🏢 Nouvelle demande de devis — Gestion Locative</h1>
    <p style="color: #d1fae5; margin: 8px 0 0; font-size: 13px;">Altimmo — Reçue le ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
  </div>
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
    <h2 style="color: #1f2937; font-size: 16px; margin-top: 0;">📋 Informations du bien</h2>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <tr style="background: #f8fafc;">
        <td style="padding: 10px 14px; font-weight: 600; color: #374151; width: 40%; border-bottom: 1px solid #e5e7eb;">Adresse du bien</td>
        <td style="padding: 10px 14px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">${data.adresseBien}</td>
      </tr>
      <tr>
        <td style="padding: 10px 14px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">Type de bien</td>
        <td style="padding: 10px 14px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">${data.typeBien}</td>
      </tr>
      <tr style="background: #f8fafc;">
        <td style="padding: 10px 14px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">Surface</td>
        <td style="padding: 10px 14px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">${data.surface ? `${data.surface} m²` : 'Non précisée'}</td>
      </tr>
      <tr>
        <td style="padding: 10px 14px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">Loyer souhaité</td>
        <td style="padding: 10px 14px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">${data.loyerSouhaite ? `${data.loyerSouhaite} FCFA` : 'Non précisé'}</td>
      </tr>
      <tr style="background: #f8fafc;">
        <td style="padding: 10px 14px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">Nombre de biens à gérer</td>
        <td style="padding: 10px 14px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">${data.nbBiens || 1}</td>
      </tr>
      ${data.message ? `
      <tr>
        <td style="padding: 10px 14px; font-weight: 600; color: #374151; vertical-align: top;">Message</td>
        <td style="padding: 10px 14px; color: #6b7280;">${data.message}</td>
      </tr>` : ''}
    </table>

    <h2 style="color: #1f2937; font-size: 16px;">👤 Coordonnées du demandeur</h2>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <tr style="background: #f8fafc;">
        <td style="padding: 10px 14px; font-weight: 600; color: #374151; width: 40%; border-bottom: 1px solid #e5e7eb;">Nom complet</td>
        <td style="padding: 10px 14px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">${data.nom}</td>
      </tr>
      <tr>
        <td style="padding: 10px 14px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">Email</td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #e5e7eb;">
          <a href="mailto:${data.email}" style="color: #059669;">${data.email}</a>
        </td>
      </tr>
      <tr style="background: #f8fafc;">
        <td style="padding: 10px 14px; font-weight: 600; color: #374151;">Téléphone</td>
        <td style="padding: 10px 14px;">
          <a href="tel:${data.telephone}" style="color: #059669;">${data.telephone || 'Non renseigné'}</a>
        </td>
      </tr>
    </table>

    <div style="background: #ecfdf5; border-left: 4px solid #10B981; padding: 16px; border-radius: 0 8px 8px 0; margin-top: 8px;">
      <p style="margin: 0; color: #065f46; font-size: 13px; font-weight: 600;">⚡ Action requise</p>
      <p style="margin: 6px 0 0; color: #047857; font-size: 13px;">
        Répondre au client sous 24h à : <a href="mailto:${data.email}" style="color: #047857; font-weight: bold;">${data.email}</a>
      </p>
    </div>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
    <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
      Altitude Vision Altimmo — <a href="https://altitudevision.agency/altimmo" style="color: #059669;">altitudevision.agency/altimmo</a>
    </p>
  </div>
</div>
`;

// ── POST /api/devis (public) ──────────────────────────────────
router.post('/', async (req, res) => {
    const { nom, email, telephone, adresseBien, typeBien, surface, loyerSouhaite, nbBiens, message } = req.body;

    if (!nom || !email || !adresseBien || !typeBien) {
        return res.status(400).json({
            status:  'fail',
            message: 'Champs obligatoires manquants : nom, email, adresse du bien, type de bien.',
        });
    }

    try {
        const devis = await Devis.create({
            nom, email, telephone, adresseBien, typeBien, surface, loyerSouhaite, nbBiens, message,
        });

        // Email de notification à l'agence — best-effort : un échec d'envoi ne
        // doit pas faire échouer la requête, le devis est déjà persisté en base.
        try {
            const agenceEmail = process.env.ZOHO_FROM_EMAIL || 'support@altitudevision.agency';
            await sendEmail({
                email:   agenceEmail,
                subject: `🏢 Nouvelle demande de devis — ${typeBien} à ${adresseBien}`,
                html:    getDevisEmailTemplate({ nom, email, telephone, adresseBien, typeBien, surface, loyerSouhaite, nbBiens, message }),
            });
        } catch (err) {
            console.error('❌ [Devis] Échec de l\'email de notification (devis conservé):', err.message);
        }

        console.log(`✅ [Devis] Demande reçue de ${nom} (${email}) pour ${typeBien} à ${adresseBien}`);

        res.status(201).json({
            status:  'success',
            message: 'Votre demande de devis a été envoyée ! Notre équipe vous contactera sous 24h.',
            data:    { devis },
        });
    } catch (err) {
        console.error('❌ [Devis] Erreur création:', err.message);
        res.status(500).json({
            status:  'error',
            message: 'Erreur lors de l\'envoi de votre demande. Veuillez réessayer.',
        });
    }
});

// ── GET /api/devis — liste toutes les demandes (Admin/Collaborateur) ────────
router.get('/', staffOnly, async (req, res) => {
    try {
        const devis = await Devis.find()
            .populate('traitePar', 'name')
            .sort('-createdAt');

        res.status(200).json({
            status:  'success',
            results: devis.length,
            data:    { devis },
        });
    } catch (err) {
        console.error('❌ [Devis] Erreur récupération liste:', err.message);
        res.status(500).json({ status: 'error', message: 'Erreur lors de la récupération des demandes.' });
    }
});

// ── PATCH /api/devis/:id — met à jour statut + noteInterne (Admin/Collaborateur) ──
router.patch('/:id', staffOnly, async (req, res) => {
    try {
        const { statut, noteInterne } = req.body;
        const devis = await Devis.findById(req.params.id);

        if (!devis) {
            return res.status(404).json({ status: 'fail', message: 'Demande de devis introuvable.' });
        }

        if (statut !== undefined)      devis.statut = statut;
        if (noteInterne !== undefined) devis.noteInterne = noteInterne;
        devis.traitePar = req.user.id;

        await devis.save();
        await devis.populate('traitePar', 'name');

        res.status(200).json({
            status: 'success',
            data:   { devis },
        });
    } catch (err) {
        console.error('❌ [Devis] Erreur mise à jour:', err.message);
        res.status(500).json({ status: 'error', message: 'Erreur lors de la mise à jour de la demande.' });
    }
});

module.exports = router;
