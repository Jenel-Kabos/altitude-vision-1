require('dotenv').config();
const zohoMailService = require('./server/services/zohoMailService');

async function testZoho() {
  try {
    console.log('🧪 Test de connexion à Zoho Mail...\n');

    const token = await zohoMailService.getAccessToken();
    console.log('✅ Access Token obtenu:', token.substring(0, 20) + '...\n');

    // CHANGÉ : getAllUsers() → getAllAccounts()
    const accounts = await zohoMailService.getAllAccounts();
    console.log('✅ Comptes trouvés:', accounts.length);
    console.log('Emails existants:');
    accounts.forEach(account => {
      console.log(`  - ${account.primaryEmailAddress} (${account.displayName})`);
      
      // Afficher les alias si présents
      if (account.emailAddress && account.emailAddress.length > 1) {
        console.log('    Alias:');
        account.emailAddress.forEach(email => {
          if (!email.isPrimary) {
            console.log(`      • ${email.mailId}`);
          }
        });
      }
    });

    console.log('\n🎉 Tous les tests sont passés !');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

testZoho();