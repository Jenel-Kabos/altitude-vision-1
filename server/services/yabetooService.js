const axios = require('axios');
const API = process.env.YABETOO_API_URL || 'https://pay.sandbox.yabetoopay.com/v1';
const client = axios.create({
  baseURL: API,
  headers: { Authorization: `Bearer ${process.env.YABETOO_SECRET_KEY}` }
});
exports.createIntent = async ({ amount, phone, operator, firstName, lastName, description, metadata }) =>
  (await client.post('/payment-intents', {
    amount, currency: 'XAF',
    payment_method_data: { type: 'momo', momo: { msisdn: phone, country: 'CG', operator_name: operator } },
    customer: { first_name: firstName, last_name: lastName },
    description, metadata
  })).data;
exports.confirmIntent = async (id) => (await client.post(`/payment-intents/${id}/confirm`)).data;
exports.getIntent    = async (id) => (await client.get(`/payment-intents/${id}`)).data;
