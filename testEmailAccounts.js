require('dotenv').config();
const zohoMailService = require('./server/services/zohoMailService');

async function testEmailAccounts() {
  try {
    console.log('🧪 Test des comptes email créés...\n');

    const accounts = await zohoMailService.getAllAccounts();
    
    console.log(`✅ Total de comptes : ${accounts.length}\n`);
    
    accounts.forEach((account, index) => {
      console.log(`${index + 1}. ${account.primaryEmailAddress}`);
      console.log(`   Nom : ${account.displayName}`);
      console.log(`   Rôle : ${account.role}`);
      console.log(`   Statut : ${account.status ? '✅ Actif' : '❌ Inactif'}`);
      
      // Afficher les alias
      if (account.emailAddress && account.emailAddress.length > 1) {
        console.log('   Alias :');
        account.emailAddress.forEach(email => {
          if (!email.isPrimary) {
            console.log(`     • ${email.mailId}`);
          }
        });
      }
      console.log('');
    });

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

testEmailAccounts();