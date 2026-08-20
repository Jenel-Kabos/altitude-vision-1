// PAY-4 — transport MTN MoMo Collections (Request to Pay), API v1_0.
// Contrat basé sur momo.mtn.com/api/ (marché "Congo Brazzaville" confirmé
// listé) et corroboré structurellement contre une capture Postman tierce
// d'un test sandbox réel — voir server/docs/PAY4_MTN_MOMO_REPORT.md §3-7
// pour les sources et leurs limites exactes. AUCUNE logique financière ici :
// ce module ne connaît ni FinancialPayment, ni allocation, ni ledger — voir
// mtnMoMoProvider.js pour l'adaptateur, et le mandat PAY-4 §7/§30.
//
// Séquence documentée : API User (provisionné hors-ligne, une fois, pas à
// chaque paiement) → API Key → Token (Basic apiUser:apiKey) → RequestToPay
// (Bearer) → GetTransactionStatus (Bearer). Ce module implémente Token,
// RequestToPay, GetTransactionStatus — la création d'API User/Key est une
// opération de provisioning ponctuelle, hors du chemin d'un paiement, non
// implémentée ici (mandat §10 : pas d'appel réel sans credentials déjà
// fournis par le provisioning MTN, qui reste externe à cette session).
const axios = require('axios');
const crypto = require('crypto');
const { getMtnMoMoConfig } = require('./mtnMoMoConfig');
const { fail, FinancialError } = require('../../../finance/financialError');
const logger = require('../../../../utils/logger');

const TOKEN_SAFETY_MARGIN_MS = 60 * 1000; // marge avant expiration réelle (PAY-4 §12)

let tokenCache = null; // { accessToken, expiresAt }
let inFlightTokenRequest = null; // PAY-4 §13 — single-flight

function httpClient(config) {
  return axios.create({
    baseURL: config.baseUrl,
    timeout: 15000,
    headers: { 'Ocp-Apim-Subscription-Key': config.subscriptionKey },
  });
}

function mapTransportError(error, context) {
  // PAY-4 §40 — jamais le corps brut MTN renvoyé tel quel à l'appelant.
  if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
    return fail('MTN_MOMO_TIMEOUT', `Délai dépassé lors de l'appel MTN MoMo (${context}). Statut réel indéterminé — ne jamais retenter une nouvelle RequestToPay sur cette base.`, 504);
  }
  const httpStatus = error?.response?.status;
  if (httpStatus === 401 || httpStatus === 403) {
    return fail('MTN_MOMO_AUTH_FAILED', `Authentification MTN MoMo refusée (${context}).`, 502);
  }
  if (httpStatus === 404) {
    return fail('MTN_MOMO_REFERENCE_NOT_FOUND', `Référence introuvable côté MTN MoMo (${context}).`, 502);
  }
  return fail('MTN_MOMO_PROVIDER_ERROR', `Erreur de communication avec MTN MoMo (${context}).`, 502);
}

async function fetchAccessToken(config) {
  const client = httpClient(config);
  const basicAuth = Buffer.from(`${config.apiUser}:${config.apiKey}`).toString('base64');
  const startedAt = Date.now();
  try {
    const response = await client.post('/collection/token/', null, {
      headers: { Authorization: `Basic ${basicAuth}`, 'X-Target-Environment': config.environment },
    });
    const { access_token: accessToken, expires_in: expiresIn } = response.data || {};
    if (!accessToken || !Number.isFinite(Number(expiresIn))) {
      fail('MTN_MOMO_PROVIDER_ERROR', 'Réponse de jeton MTN MoMo invalide.', 502);
    }
    logger.info('mtn_momo.token.fetched', { durationMs: Date.now() - startedAt, expiresIn }); // jamais le token lui-même (§9/§49)
    return { accessToken, expiresAt: Date.now() + Number(expiresIn) * 1000 };
  } catch (error) {
    if (error instanceof FinancialError) throw error; // déjà mappée (ex: réponse invalide ci-dessus)
    throw mapTransportError(error, 'token');
  }
}

async function getAccessToken(config) {
  if (tokenCache && tokenCache.expiresAt - TOKEN_SAFETY_MARGIN_MS > Date.now()) {
    return tokenCache.accessToken;
  }
  if (!inFlightTokenRequest) {
    inFlightTokenRequest = fetchAccessToken(config)
      .then((result) => { tokenCache = result; return result.accessToken; })
      .finally(() => { inFlightTokenRequest = null; });
  }
  return inFlightTokenRequest;
}

// PAY-4 §14 — la référence est TOUJOURS générée côté serveur, jamais reçue
// du client (elle détermine l'idempotence — mandat §14/§18).
function generateReferenceId() {
  return crypto.randomUUID();
}

async function requestToPay({ referenceId, amountMinor, msisdn, externalId, payerMessage, payeeNote }) {
  const config = getMtnMoMoConfig();
  const accessToken = await getAccessToken(config);
  const client = httpClient(config);
  const startedAt = Date.now();
  try {
    const response = await client.post('/collection/v1_0/requesttopay', {
      amount: String(amountMinor), // XAF = 0 décimale, cohérent avec moneyService (Financial Core)
      currency: config.currency,
      externalId,
      payer: { partyIdType: 'MSISDN', partyId: msisdn },
      payerMessage: payerMessage || 'Paiement Altimmo',
      payeeNote: payeeNote || 'Paiement Altimmo',
    }, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Reference-Id': referenceId,
        'X-Target-Environment': config.environment,
        ...(config.callbackUrl ? { 'X-Callback-Url': config.callbackUrl } : {}),
        'Content-Type': 'application/json',
      },
    });
    logger.info('mtn_momo.requesttopay.accepted', { referenceId: maskReference(referenceId), httpStatus: response.status, durationMs: Date.now() - startedAt });
    if (response.status !== 202) {
      // PAY-4 §19 — un statut différent de 202 n'est jamais interprété
      // comme un succès implicite.
      fail('MTN_MOMO_PROVIDER_ERROR', `Réponse RequestToPay inattendue (HTTP ${response.status}).`, 502);
    }
    return { referenceId, providerStatus: 'PENDING' };
  } catch (error) {
    if (error instanceof FinancialError) throw error;
    logger.warn('mtn_momo.requesttopay.error', { referenceId: maskReference(referenceId), durationMs: Date.now() - startedAt, httpStatus: error?.response?.status });
    throw mapTransportError(error, 'requesttopay');
  }
}

async function getTransactionStatus({ referenceId }) {
  const config = getMtnMoMoConfig();
  const accessToken = await getAccessToken(config);
  const client = httpClient(config);
  try {
    const response = await client.get(`/collection/v1_0/requesttopay/${referenceId}`, {
      headers: { Authorization: `Bearer ${accessToken}`, 'X-Target-Environment': config.environment },
    });
    const { status, reason, financialTransactionId } = response.data || {};
    if (!status) fail('MTN_MOMO_PROVIDER_ERROR', 'Réponse de statut MTN MoMo invalide.', 502);
    return { status, reason: reason || null, financialTransactionId: financialTransactionId || null };
  } catch (error) {
    if (error instanceof FinancialError) throw error;
    throw mapTransportError(error, 'status');
  }
}

// PAY-4 §38/§49 — jamais le MSISDN complet en log/audit.
function maskReference(referenceId) {
  return referenceId ? `${referenceId.slice(0, 8)}…` : referenceId;
}
function maskMsisdn(msisdn) {
  const digits = String(msisdn || '');
  return digits.length > 4 ? `${'*'.repeat(digits.length - 4)}${digits.slice(-4)}` : '****';
}

module.exports = {
  generateReferenceId, requestToPay, getTransactionStatus, getAccessToken,
  maskReference, maskMsisdn,
  // exposés uniquement pour les tests (réinitialisation du cache/single-flight) :
  _resetForTests: () => { tokenCache = null; inFlightTokenRequest = null; },
};
