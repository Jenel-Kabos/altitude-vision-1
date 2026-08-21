const axios = require('axios');
const DEFAULT_API = 'https://pay.sandbox.yabetoopay.com/v1';
const DEFAULT_TIMEOUT_MS = 15000;

class YabetooError extends Error {
  constructor(code, message, statusCode = 502, details = {}) {
    super(message); this.name = 'YabetooError'; this.code = code; this.statusCode = statusCode; this.details = details;
  }
}

function config() {
  const secret = String(process.env.YABETOO_SECRET_KEY || '').trim();
  const baseURL = String(process.env.YABETOO_API_URL || DEFAULT_API).replace(/\/$/, '');
  const timeout = Number(process.env.YABETOO_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  if (!secret) throw new YabetooError('provider_auth_failure', 'Configuration Yabetoo absente.', 503);
  if (!/^https:\/\//.test(baseURL) || !Number.isInteger(timeout) || timeout <= 0) throw new YabetooError('provider_invalid_config', 'Configuration Yabetoo invalide.', 503);
  return { secret, baseURL, timeout };
}

function classify(error, phase) {
  if (error instanceof YabetooError) return error;
  const status = error?.response?.status;
  if (error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT') return new YabetooError('provider_timeout_unknown', `Résultat Yabetoo ${phase} inconnu après timeout.`, 503, { phase, ambiguous: true });
  if (status === 401 || status === 403) return new YabetooError('provider_auth_failure', 'Authentification Yabetoo refusée.', 503, { phase });
  if (status >= 400 && status < 500) return new YabetooError('provider_rejected', `Requête Yabetoo ${phase} refusée.`, 422, { phase, providerStatus: status });
  if (status >= 500 || error?.code) return new YabetooError('provider_unavailable', `Service Yabetoo indisponible pendant ${phase}.`, 503, { phase });
  return new YabetooError('provider_invalid_response', `Réponse Yabetoo ${phase} invalide.`, 502, { phase });
}

async function request(method, path, data, phase) {
  const { secret, baseURL, timeout } = config();
  try {
    const response = await axios({ method, baseURL, url: path, data, timeout, headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' } });
    return response.data;
  } catch (error) { throw classify(error, phase); }
}

exports.createIntent = async ({ amount, description, metadata }) => {
  if (!Number.isInteger(amount) || amount <= 0) throw new YabetooError('provider_invalid_request', 'Le montant Yabetoo doit être un entier positif.', 422);
  return request('post', '/payment-intents', { amount, currency: 'XAF', description, metadata }, 'create');
};
exports.confirmIntent = async (id, { clientSecret, phone, operator, firstName, lastName, receiptEmail } = {}) => {
  if (!id || !clientSecret || !phone || !operator) throw new YabetooError('provider_invalid_request', 'Données de confirmation Yabetoo incomplètes.', 422);
  const body = { client_secret: clientSecret, payment_method_data: { type: 'momo', momo: { country: 'CG', msisdn: phone, operator_name: operator } } };
  if (firstName) body.first_name = firstName;
  if (lastName) body.last_name = lastName;
  if (receiptEmail) body.receipt_email = receiptEmail;
  return request('post', `/payment-intents/${encodeURIComponent(id)}/confirm`, body, 'confirm');
};
exports.getIntent = async (id) => {
  if (!id) throw new YabetooError('provider_invalid_request', 'Référence Yabetoo absente.', 422);
  return request('get', `/payment-intents/${encodeURIComponent(id)}`, undefined, 'status');
};
exports.extractIntent = (payload) => ({ id: payload?.id || payload?.data?.id, clientSecret: payload?.clientSecret || payload?.client_secret || payload?.data?.clientSecret || payload?.data?.client_secret, status: payload?.status || payload?.data?.status });
exports.YabetooError = YabetooError;
exports._private = { config, classify, DEFAULT_API, DEFAULT_TIMEOUT_MS };
