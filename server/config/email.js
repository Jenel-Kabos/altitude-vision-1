// server/config/email.js
const nodemailer = require('nodemailer');
const axios = require('axios');

// ============================================================
// 🔄 Récupère un Access Token frais via le Refresh Token
// ============================================================
const getZohoAccessToken = async () => {
  try {
    const response = await axios.post('https://accounts.zoho.com/oauth/v2/token', null, {
      params: {
        refresh_token: process.env.ZOHO_REFRESH_TOKEN,
        client_id: process.env.ZOHO_CLIENT_ID,
        client_secret: process.env.ZOHO_CLIENT_SECRET,
        grant_type: 'refresh_token',
      },
    });

    const { access_token } = response.data;

    if (!access_token) {
      throw new Error('Impossible de récupérer le access_token Zoho');
    }

    console.log('✅ [Email] Access Token Zoho récupéré');
    return access_token;

  } catch (error) {
    console.error('❌ [Email] Erreur récupération Access Token:', error.message);
    throw new Error('Échec de l\'authentification Zoho OAuth2');
  }
};

// ============================================================
// 📧 Fonction principale d'envoi d'email
// ============================================================
const sendEmail = async (options) => {
  try {
    // 1. Récupérer un access token frais
    const accessToken = await getZohoAccessToken();

    // 2. Créer le transporteur Nodemailer avec OAuth2
    const transporter = nodemailer.createTransport({
      host: 'smtp.zoho.com',
      port: 465,
      secure: true,
      auth: {
        type: 'OAuth2',
        user: process.env.ZOHO_FROM_EMAIL,
        accessToken,
      },
    });

    // 3. Construire le message
    const message = {
      from: `"${process.env.ZOHO_FROM_NAME || 'Altitude Vision'}" <${process.env.ZOHO_FROM_EMAIL}>`,
      to: options.to,
      cc: options.cc || undefined,
      subject: options.subject,
      html: options.html,
      text: options.text || undefined,
    };

    // 4. Envoyer
    const info = await transporter.sendMail(message);
    console.log(`✅ [Email] Envoyé avec succès: ${info.messageId}`);
    return info;

  } catch (error) {
    console.error(`❌ [Email] Erreur envoi: ${error.message}`);
    throw new Error("L'email n'a pas pu être envoyé.");
  }
};

// ============================================================
// 📧 Templates d'emails prêts à l'emploi
// ============================================================

// Email de vérification compte
const sendVerificationEmail = async (to, verificationUrl) => {
  await sendEmail({
    to,
    subject: '✅ Vérifiez votre adresse email — Altitude Vision',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Altitude Vision</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
          <h2 style="color: #1f2937;">Vérifiez votre adresse email</h2>
          <p style="color: #6b7280;">Cliquez sur le bouton ci-dessous pour activer votre compte :</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" 
               style="background: #2563eb; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
              Vérifier mon email
            </a>
          </div>
          <p style="color: #9ca3af; font-size: 13px;">Ce lien expire dans 24 heures. Si vous n'avez pas créé de compte, ignorez cet email.</p>
        </div>
      </div>
    `,
  });
};

// Email de réinitialisation de mot de passe
const sendPasswordResetEmail = async (to, resetUrl) => {
  await sendEmail({
    to,
    subject: '🔐 Réinitialisation de votre mot de passe — Altitude Vision',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Altitude Vision</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
          <h2 style="color: #1f2937;">Réinitialisation du mot de passe</h2>
          <p style="color: #6b7280;">Vous avez demandé la réinitialisation de votre mot de passe. Cliquez ci-dessous :</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background: #dc2626; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
              Réinitialiser mon mot de passe
            </a>
          </div>
          <p style="color: #9ca3af; font-size: 13px;">Ce lien expire dans 10 minutes. Si vous n'avez pas fait cette demande, ignorez cet email.</p>
        </div>
      </div>
    `,
  });
};

// Email de confirmation de devis
const sendQuoteConfirmationEmail = async (to, quoteDetails) => {
  await sendEmail({
    to,
    subject: '📋 Votre demande de devis a été reçue — Altitude Vision',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Altitude Vision</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
          <h2 style="color: #1f2937;">Demande de devis reçue ✅</h2>
          <p style="color: #6b7280;">Bonjour <strong>${quoteDetails.name || 'Client'}</strong>,</p>
          <p style="color: #6b7280;">Nous avons bien reçu votre demande de devis et nous vous répondrons dans les plus brefs délais.</p>
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
            <p style="margin: 0; color: #1f2937;"><strong>Service :</strong> ${quoteDetails.service || 'Non spécifié'}</p>
            <p style="margin: 8px 0 0; color: #1f2937;"><strong>Message :</strong> ${quoteDetails.message || 'Aucun message'}</p>
          </div>
          <p style="color: #6b7280;">Notre équipe vous contactera sous 24-48 heures.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="color: #9ca3af; font-size: 13px; text-align: center;">
            Altitude Vision — Agence multidisciplinaire à Brazzaville<br/>
            <a href="https://altitudevision.agency" style="color: #2563eb;">altitudevision.agency</a>
          </p>
        </div>
      </div>
    `,
  });
};

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendQuoteConfirmationEmail,
};