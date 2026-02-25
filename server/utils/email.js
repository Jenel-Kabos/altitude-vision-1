// server/utils/email.js
// 🌉 Pont entre authController (ancien système) et zohoMailService (OAuth2)
const zohoMailService = require('../services/zohoMailService');

// ============================================================
// 📧 Templates HTML
// ============================================================

const getVerificationTemplate = (name, verifyURL) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">Altitude Vision</h1>
      <p style="color: #bfdbfe; margin: 8px 0 0; font-size: 14px;">Agence multidisciplinaire à Brazzaville</p>
    </div>
    <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
      <h2 style="color: #1f2937;">Bonjour ${name} 👋</h2>
      <p style="color: #6b7280; line-height: 1.6;">
        Merci de vous être inscrit sur <strong>Altitude Vision</strong>. 
        Cliquez sur le bouton ci-dessous pour activer votre compte :
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${verifyURL}" 
           style="background: #2563eb; color: white; padding: 14px 36px; border-radius: 8px; 
                  text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">
          ✅ Activer mon compte
        </a>
      </div>
      <p style="color: #9ca3af; font-size: 13px; text-align: center;">
        Ce lien expire dans <strong>24 heures</strong>.<br/>
        Si vous n'avez pas créé de compte, ignorez cet email.
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 12px; text-align: center;">
        Altitude Vision — <a href="https://altitudevision.agency" style="color: #2563eb;">altitudevision.agency</a>
      </p>
    </div>
  </div>
`;

const getPasswordResetTemplate = (name, resetURL) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">Altitude Vision</h1>
      <p style="color: #bfdbfe; margin: 8px 0 0; font-size: 14px;">Réinitialisation du mot de passe</p>
    </div>
    <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
      <h2 style="color: #1f2937;">Bonjour ${name} 🔐</h2>
      <p style="color: #6b7280; line-height: 1.6;">
        Vous avez demandé la réinitialisation de votre mot de passe. 
        Cliquez ci-dessous pour en créer un nouveau :
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${resetURL}" 
           style="background: #dc2626; color: white; padding: 14px 36px; border-radius: 8px; 
                  text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">
          🔑 Réinitialiser mon mot de passe
        </a>
      </div>
      <p style="color: #9ca3af; font-size: 13px; text-align: center;">
        Ce lien expire dans <strong>10 minutes</strong>.<br/>
        Si vous n'avez pas fait cette demande, ignorez cet email.
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 12px; text-align: center;">
        Altitude Vision — <a href="https://altitudevision.agency" style="color: #2563eb;">altitudevision.agency</a>
      </p>
    </div>
  </div>
`;

const getDefaultTemplate = (subject, message) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">Altitude Vision</h1>
    </div>
    <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
      <h2 style="color: #1f2937;">${subject}</h2>
      <p style="color: #6b7280; line-height: 1.6; white-space: pre-line;">${message}</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 12px; text-align: center;">
        Altitude Vision — <a href="https://altitudevision.agency" style="color: #2563eb;">altitudevision.agency</a>
      </p>
    </div>
  </div>
`;

// ============================================================
// 📤 Fonction principale (compatible avec authController)
// ============================================================
const sendEmail = async (options) => {
  try {
    const fromEmail = process.env.ZOHO_FROM_EMAIL || 'support@altitudevision.agency';
    const toEmail = options.email || options.to;
    const subject = options.subject;

    // Sélection du template HTML selon le type
    let htmlContent;

    if (options.type === 'verification' && options.verifyURL) {
      htmlContent = getVerificationTemplate(options.name || 'Utilisateur', options.verifyURL);
    } else if (options.type === 'passwordReset' && options.resetURL) {
      htmlContent = getPasswordResetTemplate(options.name || 'Utilisateur', options.resetURL);
    } else if (options.html) {
      htmlContent = options.html;
    } else {
      htmlContent = getDefaultTemplate(subject, options.message || '');
    }

    // Envoi via zohoMailService (OAuth2)
    await zohoMailService.sendEmail(fromEmail, toEmail, subject, htmlContent);

    console.log(`✅ [Email] Envoyé à ${toEmail} - Sujet: ${subject}`);

  } catch (error) {
    console.error(`❌ [Email] Erreur envoi à ${options.email || options.to}:`, error.message);
    throw new Error("L'email n'a pas pu être envoyé.");
  }
};

module.exports = sendEmail;