const express = require('express');
const axios = require('axios');

const app = express();

// REMPLACEZ PAR VOS VRAIES VALEURS
const CLIENT_ID = '1000.EOU6UR6A2JMAHZ98UJMQ7GNPZ3SMST';
const CLIENT_SECRET = '05212dc9f751bd54a7c4904350617cc58e5ed65974';
const REDIRECT_URI = 'http://localhost:3000/auth/zoho/callback'; // ✅ CORRIGÉ

// Scopes nécessaires
const SCOPES = [
  'ZohoMail.accounts.ALL',
  'ZohoMail.messages.ALL',
  'ZohoMail.organization.accounts.READ'
].join(',');

// Page d'accueil
app.get('/', (req, res) => {
  res.send(`
    <html>
      <body style="font-family: Arial; padding: 50px; text-align: center;">
        <h1>Configuration Zoho Mail API</h1>
        <p>Cliquez sur le bouton ci-dessous pour autoriser l'application</p>
        <a href="/auth/zoho" style="display: inline-block; padding: 15px 30px; background: #0066cc; color: white; text-decoration: none; border-radius: 5px; font-size: 18px;">
          Autoriser Zoho Mail
        </a>
      </body>
    </html>
  `);
});

// Étape 1: Rediriger vers Zoho pour l'autorisation
app.get('/auth/zoho', (req, res) => {
  const authUrl = `https://accounts.zoho.com/oauth/v2/auth?` +
    `scope=${SCOPES}&` +
    `client_id=${CLIENT_ID}&` +
    `response_type=code&` +
    `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
    `access_type=offline&` +
    `prompt=consent`;
  
  console.log('🔗 Redirection vers Zoho pour autorisation...');
  res.redirect(authUrl);
});

// ✅ Étape 2: Callback CORRIGÉ
app.get('/auth/zoho/callback', async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    return res.send(`
      <html>
        <body style="font-family: Arial; padding: 50px; text-align: center;">
          <h1 style="color: red;">❌ Erreur</h1>
          <p>Aucun code d'autorisation reçu</p>
          <a href="/">Réessayer</a>
        </body>
      </html>
    `);
  }

  try {
    console.log('🔄 Échange du code contre les tokens...');
    
    const response = await axios.post('https://accounts.zoho.com/oauth/v2/token', null, {
      params: {
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code'
      }
    });

    const { refresh_token, access_token, expires_in } = response.data;

    console.log('\n✅ SUCCÈS ! Tokens obtenus :\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('REFRESH_TOKEN:', refresh_token);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    res.send(`
      <html>
        <body style="font-family: Arial; padding: 50px;">
          <h1 style="color: green;">✅ Configuration réussie !</h1>
          
          <div style="background: #f5f5f5; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h2>Ajoutez ces variables dans votre fichier .env :</h2>
            <pre style="background: #333; color: #0f0; padding: 20px; border-radius: 5px; overflow-x: auto; font-size: 12px;">
ZOHO_CLIENT_ID=${CLIENT_ID}
ZOHO_CLIENT_SECRET=${CLIENT_SECRET}
ZOHO_REFRESH_TOKEN=${refresh_token}
            </pre>
          </div>

          <div style="background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0;">
            <strong>⚠️ Important :</strong> Copiez ces valeurs maintenant et ajoutez-les dans votre fichier .env
          </div>

          <button onclick="navigator.clipboard.writeText('ZOHO_CLIENT_ID=${CLIENT_ID}\\nZOHO_CLIENT_SECRET=${CLIENT_SECRET}\\nZOHO_REFRESH_TOKEN=${refresh_token}')" 
                  style="padding: 10px 20px; background: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer;">
            📋 Copier dans le presse-papier
          </button>

          <p style="margin-top: 30px;">
            <a href="/" style="color: #0066cc;">Retour</a>
          </p>
        </body>
      </html>
    `);

    setTimeout(() => {
      console.log('\n🛑 Arrêt du serveur dans 60 secondes...');
      setTimeout(() => process.exit(0), 60000);
    }, 1000);

  } catch (error) {
    console.error('❌ Erreur:', error.response?.data || error.message);
    
    res.send(`
      <html>
        <body style="font-family: Arial; padding: 50px; text-align: center;">
          <h1 style="color: red;">❌ Erreur</h1>
          <pre style="background: #f5f5f5; padding: 20px; text-align: left; overflow-x: auto;">${JSON.stringify(error.response?.data || error.message, null, 2)}</pre>
          <a href="/">Réessayer</a>
        </body>
      </html>
    `);
  }
});

// Démarrer le serveur
const PORT = 3000;
app.listen(PORT, () => {
  console.log('\n🚀 Serveur de configuration Zoho démarré !');
  console.log(`📍 Ouvrez votre navigateur sur : http://localhost:${PORT}\n`);
  console.log('⚠️  Si le navigateur ne s\'ouvre pas automatiquement, copiez l\'URL ci-dessus\n');
});
