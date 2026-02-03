// config/email.js
import nodemailer from 'nodemailer';

const sendEmail = async (options) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      // secure: false car le port 587 utilise STARTTLS pour la mise à niveau de la connexion
      secure: process.env.SMTP_PORT === '465', 
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const message = {
      from: process.env.EMAIL_FROM,
      to: options.to,
      cc: options.cc,
      subject: options.subject,
      html: options.html,
    };

    const info = await transporter.sendMail(message);
    console.log(`✅ Email envoyé avec succès: ${info.messageId}`.blue);
    
  } catch (error) {
    console.error(`❌ Erreur lors de l'envoi de l'email: ${error.message}`.red);
    // On propage l'erreur pour que le contrôleur appelant puisse la gérer
    throw new Error("L'email n'a pas pu être envoyé.");
  }
};

export default sendEmail;