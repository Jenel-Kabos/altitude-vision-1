// PAY-4 — configuration MTN MoMo, exclusivement serveur. Aucune de ces
// variables ne doit jamais apparaître dans client/ ou altimmo-app/
// (EXPO_PUBLIC_*/NEXT_PUBLIC_*) — mandat PAY-4 §8/§9. Validation paresseuse
// (à l'usage, pas au chargement du module) pour ne jamais faire échouer le
// démarrage du serveur si MTN n'est pas configuré dans un environnement
// donné (sandbox reste optionnel tant qu'aucun credential n'est fourni).
const { fail } = require('../../../finance/financialError');

const REQUIRED_VARS = [
  'MTN_MOMO_ENVIRONMENT',      // 'sandbox' | future valeur marché réelle (ex. 'mtncongo')
  'MTN_MOMO_BASE_URL',         // sandbox.momodeveloper.mtn.com en sandbox
  'MTN_MOMO_SUBSCRIPTION_KEY', // Ocp-Apim-Subscription-Key du produit Collections souscrit
  'MTN_MOMO_API_USER',         // UUID de l'API User créé (POST /v1_0/apiuser)
  'MTN_MOMO_API_KEY',          // clé associée (POST /v1_0/apiuser/{id}/apikey)
];
// Optionnelles — absentes n'empêchent pas le fonctionnement de base :
// MTN_MOMO_CALLBACK_URL (X-Callback-Url — la corroboration GET reste
// obligatoire quoi qu'il arrive, voir mtnMoMoProvider.js) ;
// MTN_MOMO_CURRENCY (devise envoyée à MTN, distincte de la devise stockée
// dans FinancialPayment — le bac à sable MTN n'accepte historiquement que
// EUR quel que soit le marché ciblé, comportement non confirmé depuis la
// documentation primaire officielle dans cette session, voir
// PAY4_MTN_MOMO_REPORT.md §17 — défaut 'EUR' si absent).

function getMtnMoMoConfig() {
  const missing = REQUIRED_VARS.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    fail('MTN_MOMO_CONFIG_MISSING', `Configuration MTN MoMo incomplète : ${missing.join(', ')}.`, 503);
  }
  return {
    environment: process.env.MTN_MOMO_ENVIRONMENT,
    baseUrl: process.env.MTN_MOMO_BASE_URL,
    subscriptionKey: process.env.MTN_MOMO_SUBSCRIPTION_KEY,
    apiUser: process.env.MTN_MOMO_API_USER,
    apiKey: process.env.MTN_MOMO_API_KEY,
    callbackUrl: process.env.MTN_MOMO_CALLBACK_URL || null,
    currency: process.env.MTN_MOMO_CURRENCY || 'EUR',
  };
}

function isMtnMoMoConfigured() {
  return REQUIRED_VARS.every((name) => Boolean(process.env[name]));
}

module.exports = { getMtnMoMoConfig, isMtnMoMoConfigured, REQUIRED_VARS };
