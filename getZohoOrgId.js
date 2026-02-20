const axios = require('axios');

const CLIENT_ID = '1000.3H6S9BNXXPWHWLOVPHT4ZYGKAKJYPK';
const CLIENT_SECRET = '874cf1e3bf30417dbdf0c4c2f2ef93ac3a35a205bb';
const REFRESH_TOKEN = '1000.3286ccccacf592362a2cc1986fd80230.29c86d41404a132bc8cd40b1f58e0418';

async function getAccessToken() {
  const response = await axios.post('https://accounts.zoho.com/oauth/v2/token', null, {
    params: {
      refresh_token: REFRESH_TOKEN,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'refresh_token'
    }
  });
  return response.data.access_token;
}

async function getOrganizationInfo() {
  try {
    const accessToken = await getAccessToken();
    console.log('✅ Access Token obtenu\n');

    // Essayer différentes endpoints Zoho Mail
    console.log('🔍 Recherche de votre Organization ID...\n');

    // Endpoint 1: Organizations
    try {
      const orgResponse = await axios.get('https://mail.zoho.com/api/organization', {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`
        }
      });
      
      console.log('📋 Réponse Organization:');
      console.log(JSON.stringify(orgResponse.data, null, 2));
    } catch (err) {
      console.log('⚠️  Endpoint organization non accessible');
    }

    // Endpoint 2: Accounts
    try {
      const accountsResponse = await axios.get('https://mail.zoho.com/api/accounts', {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`
        }
      });
      
      console.log('\n📋 Réponse Accounts:');
      console.log(JSON.stringify(accountsResponse.data, null, 2));
      
      if (accountsResponse.data.data && accountsResponse.data.data.length > 0) {
        const accountId = accountsResponse.data.data[0].accountId;
        console.log('\n✅ Votre Account ID:', accountId);
        console.log('\nAjoutez ceci à votre .env:');
        console.log(`ZOHO_ACCOUNT_ID=${accountId}`);
      }
    } catch (err) {
      console.log('⚠️  Endpoint accounts:', err.response?.status, err.response?.statusText);
    }

    // Endpoint 3: User info
    try {
      const userResponse = await axios.get('https://mail.zoho.com/api/accounts/me', {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`
        }
      });
      
      console.log('\n📋 Réponse User Info:');
      console.log(JSON.stringify(userResponse.data, null, 2));
    } catch (err) {
      console.log('⚠️  Endpoint user non accessible');
    }

  } catch (error) {
    console.error('\n❌ Erreur:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.log('\n💡 Le token a peut-être expiré. Essayez de regénérer un nouveau Refresh Token.');
    }
  }
}

getOrganizationInfo();