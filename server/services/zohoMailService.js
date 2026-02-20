const axios = require('axios');

class ZohoMailService {
  constructor() {
    this.baseUrl = 'https://mail.zoho.com/api';
    this.accountsUrl = 'https://accounts.zoho.com/oauth/v2';
    this.clientId = process.env.ZOHO_CLIENT_ID;
    this.clientSecret = process.env.ZOHO_CLIENT_SECRET;
    this.refreshToken = process.env.ZOHO_REFRESH_TOKEN;
    this.accountId = process.env.ZOHO_ACCOUNT_ID;
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  async getAccessToken() {
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await axios.post(`${this.accountsUrl}/token`, null, {
        params: {
          refresh_token: this.refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'refresh_token'
        }
      });

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000;
      return this.accessToken;
    } catch (error) {
      console.error('Erreur token:', error.response?.data || error);
      throw new Error('Impossible d\'authentifier avec Zoho');
    }
  }

  async getAllAccounts() {
    try {
      const token = await this.getAccessToken();
      
      const response = await axios.get(`${this.baseUrl}/accounts`, {
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`
        }
      });

      return response.data.data || [];
    } catch (error) {
      console.error('Erreur comptes:', error.response?.data || error);
      throw new Error('Erreur lors de la récupération des comptes');
    }
  }

  // MÉTHODE POUR ENVOYER UN EMAIL
  async sendEmail(fromEmail, toEmail, subject, content) {
    try {
      const token = await this.getAccessToken();
      
      const response = await axios.post(
        `${this.baseUrl}/accounts/${this.accountId}/messages`,
        {
          fromAddress: fromEmail,
          toAddress: toEmail,
          subject: subject,
          content: content,
          mailFormat: 'html'
        },
        {
          headers: {
            'Authorization': `Zoho-oauthtoken ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Erreur envoi email:', error.response?.data || error);
      throw new Error('Erreur lors de l\'envoi de l\'email');
    }
  }

  generatePassword(length = 16) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  }
}

module.exports = new ZohoMailService();