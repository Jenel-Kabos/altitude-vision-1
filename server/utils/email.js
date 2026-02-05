const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  // 1) Créer un transporteur (Le camion du facteur)
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  // 2) Définir les options de l'email
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: options.email,
    subject: options.subject,
    text: options.message,
    // html: options.html // Tu pourras ajouter du HTML plus tard pour faire joli
  };

  // 3) Envoyer l'email
  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;