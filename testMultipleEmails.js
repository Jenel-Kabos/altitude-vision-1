require('dotenv').config();
const zohoMailService = require('./server/services/zohoMailService');

async function testMultipleEmails() {
  try {
    console.log('📧 Test d\'envoi d\'emails multiples...\n');

    const recipients = [
      {
        email: 'thibautkabos@gmail.com',
        name: 'Thibaut'
      }
      // Ajoutez d'autres destinataires si vous voulez tester
    ];

    for (const recipient of recipients) {
      console.log(`📤 Envoi à ${recipient.name} (${recipient.email})...`);

      const content = `
        <html>
          <body style="font-family: Arial; padding: 20px;">
            <h1>Bonjour ${recipient.name} ! 👋</h1>
            <p>Ceci est un email personnalisé envoyé depuis Altitude Vision.</p>
            <p>Notre système de gestion d'emails fonctionne parfaitement !</p>
            <br>
            <p>Cordialement,<br>L'équipe Altitude Vision</p>
          </body>
        </html>
      `;

      await zohoMailService.sendEmail(
        'josephkabouende@altitudevision.agency',
        recipient.email,
        `Message personnalisé pour ${recipient.name}`,
        content
      );

      console.log(`✅ Envoyé à ${recipient.name}\n`);
      
      // Pause de 2 secondes entre chaque envoi pour éviter le rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('🎉 Tous les emails ont été envoyés avec succès !');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

testMultipleEmails();