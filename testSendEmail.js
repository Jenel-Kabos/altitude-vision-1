require('dotenv').config();
const zohoMailService = require('./server/services/zohoMailService');

async function testSendEmail() {
  try {
    console.log('📧 Test d\'envoi d\'email via Zoho Mail...\n');

    // Paramètres de l'email de test
    const emailData = {
      fromEmail: 'josephkabouende@altitudevision.agency',
      toEmail: 'thibautkabos@gmail.com', // Envoi vers votre Gmail pour tester
      subject: 'Test Email - Altitude Vision',
      content: `
        <html>
          <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <h1 style="color: #0066cc; border-bottom: 3px solid #0066cc; padding-bottom: 10px;">
                🎉 Test Altitude Vision
              </h1>
              
              <p style="font-size: 16px; line-height: 1.6; color: #333;">
                Bonjour,
              </p>
              
              <p style="font-size: 16px; line-height: 1.6; color: #333;">
                Ceci est un <strong>email de test</strong> envoyé depuis votre système Altitude Vision intégré avec Zoho Mail API.
              </p>
              
              <div style="background-color: #e8f4fd; padding: 15px; border-left: 4px solid #0066cc; margin: 20px 0;">
                <p style="margin: 0; color: #0066cc;">
                  <strong>✅ Configuration réussie !</strong>
                </p>
                <p style="margin: 10px 0 0 0; color: #666;">
                  Votre API Zoho Mail fonctionne correctement.
                </p>
              </div>
              
              <h2 style="color: #333; margin-top: 30px;">Informations techniques :</h2>
              <ul style="color: #666; line-height: 1.8;">
                <li>Expéditeur : josephkabouende@altitudevision.agency</li>
                <li>API : Zoho Mail API v1</li>
                <li>Date : ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Brazzaville' })}</li>
                <li>Statut : Production Ready ✅</li>
              </ul>
              
              <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
              
              <p style="font-size: 14px; color: #999; text-align: center;">
                © 2026 Altitude Vision Agency<br>
                Brazzaville, Congo
              </p>
            </div>
          </body>
        </html>
      `
    };

    console.log('📤 Envoi en cours...');
    console.log(`   De : ${emailData.fromEmail}`);
    console.log(`   À  : ${emailData.toEmail}`);
    console.log(`   Sujet : ${emailData.subject}\n`);

    // Envoyer l'email
    const result = await zohoMailService.sendEmail(
      emailData.fromEmail,
      emailData.toEmail,
      emailData.subject,
      emailData.content
    );

    console.log('✅ Email envoyé avec succès !');
    console.log('\n📋 Détails de la réponse :');
    console.log(JSON.stringify(result, null, 2));
    
    console.log('\n🎉 Vérifiez votre boîte mail (thibautkabos@gmail.com)');
    console.log('⚠️  Pensez à vérifier les spams si vous ne voyez pas l\'email\n');

  } catch (error) {
    console.error('\n❌ Erreur lors de l\'envoi :', error.message);
    console.error('\n💡 Détails de l\'erreur :');
    console.error(error.response?.data || error);
  }
}

testSendEmail();