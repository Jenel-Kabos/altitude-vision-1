const axios = require('axios');

// PREP-2 — jamais de credential versionné. Les anciennes valeurs présentes
// dans l'historique Git doivent être révoquées/rotées côté Zoho avant PROD.
const CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN;

if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
  throw new Error('ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET et ZOHO_REFRESH_TOKEN sont requis.');
}

async function getAccessToken() {
  const response = await axios.post('https://accounts.zoho.com/oauth/v2/token', null, {
    params: {
      refresh_token: REFRESH_TOKEN,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'refresh_token',
    },
  });
  return response.data.access_token;
}

async function getOrganizationInfo() {
  try {
    const accessToken = await getAccessToken();
    const headers = { Authorization: `Zoho-oauthtoken ${accessToken}` };
    const accountsResponse = await axios.get('https://mail.zoho.com/api/accounts', { headers });
    const accountId = accountsResponse.data?.data?.[0]?.accountId;
    if (accountId) console.log(`ZOHO_ACCOUNT_ID=${accountId}`);
    else console.log('Aucun compte Zoho disponible pour ces credentials.');
  } catch (error) {
    console.error('Impossible de récupérer les informations Zoho :', error.response?.status || error.message);
    process.exitCode = 1;
  }
}

getOrganizationInfo();
