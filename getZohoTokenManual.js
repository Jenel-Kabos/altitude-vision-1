const axios = require('axios');
const readline = require('readline');

// PREP-2 — ce script contenait auparavant un CLIENT_ID/CLIENT_SECRET Zoho
// réels codés en dur (déjà exposés en historique Git, commit 3b4c3ea, jamais
// remédié contrairement à getZohoOrgId.js) : corrigé pour lire les
// identifiants depuis l'environnement, jamais depuis le code source, même
// convention que getZohoOrgId.js. Ces credentials doivent être révoqués/
// roués côté Zoho indépendamment de ce correctif — voir
// SECRET_ROTATION_CHECKLIST.md.
const CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.log('\n❌ ZOHO_CLIENT_ID et ZOHO_CLIENT_SECRET doivent être définis dans l\'environnement avant d\'exécuter ce script.\n');
  process.exit(1);
}

const SCOPES = 'ZohoMail.accounts.ALL,ZohoMail.messages.ALL,ZohoMail.organization.accounts.READ';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║   CONFIGURATION ZOHO MAIL API - MÉTHODE MANUELLE         ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

// Étape 1: Générer l'URL d'autorisation
const authUrl = `https://accounts.zoho.com/oauth/v2/auth?scope=${SCOPES}&client_id=${CLIENT_ID}&response_type=code&access_type=offline&prompt=consent`;

console.log('📋 ÉTAPE 1 : Copiez cette URL et ouvrez-la dans votre navigateur\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(authUrl);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('📌 Instructions :');
console.log('1. Collez l\'URL ci-dessus dans votre navigateur');
console.log('2. Connectez-vous à Zoho si nécessaire');
console.log('3. Autorisez l\'application');
console.log('4. Vous serez redirigé vers une page d\'erreur (c\'est normal !)');
console.log('5. Dans la barre d\'adresse, cherchez "code=XXXXXXX"');
console.log('6. Copiez tout ce qui vient APRÈS "code=" et AVANT le prochain "&"\n');

console.log('Exemple d\'URL après redirection :');
console.log('https://example.com/?code=1000.abc123def456&location=us&accounts-server=...');
console.log('                          ^^^^^^^^^^^^^^^^');
console.log('                       Copiez seulement cette partie\n');

// Étape 2: Demander le code
rl.question('✏️  Collez le CODE ici et appuyez sur Entrée : ', async (code) => {
  
  if (!code || code.trim() === '') {
    console.log('\n❌ Aucun code fourni. Abandon.\n');
    rl.close();
    return;
  }

  const cleanCode = code.trim();
  console.log('\n🔄 Échange du code contre le Refresh Token...\n');

  try {
    const response = await axios.post('https://accounts.zoho.com/oauth/v2/token', null, {
      params: {
        code: cleanCode,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code'
      }
    });

    const { refresh_token, access_token, expires_in } = response.data;

    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                    ✅ SUCCÈS !                            ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log('📄 Ajoutez ces lignes dans votre fichier .env :\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`ZOHO_CLIENT_ID=${CLIENT_ID}`);
    console.log(`ZOHO_CLIENT_SECRET=${CLIENT_SECRET}`);
    console.log(`ZOHO_REFRESH_TOKEN=${refresh_token}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('ℹ️  Informations supplémentaires :');
    console.log(`   Access Token (expire dans ${expires_in}s) : ${access_token.substring(0, 20)}...`);
    console.log('\n⚠️  IMPORTANT : Gardez ces informations en sécurité !\n');

  } catch (error) {
    console.log('\n❌ ERREUR lors de l\'échange du code :\n');
    
    if (error.response) {
      console.log('Détails de l\'erreur :');
      console.log(JSON.stringify(error.response.data, null, 2));
      
      if (error.response.data.error === 'invalid_code') {
        console.log('\n💡 Le code a expiré ou est invalide.');
        console.log('   Les codes expirent après 60 secondes.');
        console.log('   Relancez le script et réessayez plus rapidement.\n');
      }
    } else {
      console.log(error.message);
    }
  }

  rl.close();
});