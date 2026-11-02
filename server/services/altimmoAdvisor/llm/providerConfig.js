'use strict';
// Configuration serveur du moteur de langage. Désactivé par défaut ; la clé n'est jamais sérialisée :
// elle n'est accessible que par la fonction apiKey(), réservée au fournisseur.
const PROVIDERS = ['deepseek', 'mock'];
const MODELS = { deepseek: ['deepseek-flash', 'deepseek-v4-pro'], mock: ['deepseek-flash', 'deepseek-v4-pro'] };
const OFFICIAL_BASE_URL = 'https://api.deepseek.com';

function resolveLlmConfig(env = process.env) {
  // Fournisseur simulé par défaut : DeepSeek n'est appelé que sur choix explicite de configuration.
  const provider = env.ALTIMMO_LLM_PROVIDER || 'mock';
  if (!PROVIDERS.includes(provider)) throw new Error(`Fournisseur non autorisé : ${String(provider).slice(0, 30)}`);
  const model = env.ALTIMMO_LLM_MODEL || 'deepseek-flash';
  if (!MODELS[provider].includes(model)) throw new Error(`Modèle non autorisé : ${String(model).slice(0, 30)}`);
  const baseUrl = env.ALTIMMO_LLM_BASE_URL || OFFICIAL_BASE_URL;
  if (baseUrl !== OFFICIAL_BASE_URL) throw new Error('URL du fournisseur non autorisée (seule l’API officielle DeepSeek est permise).');
  const budgetUsd = env.ALTIMMO_LLM_MONTHLY_BUDGET_USD === undefined ? 10 : Number(env.ALTIMMO_LLM_MONTHLY_BUDGET_USD);
  if (!Number.isFinite(budgetUsd) || budgetUsd < 0 || budgetUsd > 100) throw new Error('Budget mensuel invalide (0 à 100 USD).');
  const enabled = env.ALTIMMO_LLM_ENABLED === 'true';
  const key = typeof env.DEEPSEEK_API_KEY === 'string' ? env.DEEPSEEK_API_KEY.trim() : '';
  const keyConfigured = provider === 'mock' ? true : /^sk-[A-Za-z0-9_-]{16,}$/.test(key);
  const config = {
    provider, model, baseUrl, budgetUsd, enabled, keyConfigured,
    ready: enabled && keyConfigured,
    maxToolRounds: 4, maxToolCallsPerTurn: 6, maxOutputTokens: 700, historyMessages: 6, historyChars: 4000,
    sessionMaxUsd: Number(env.ALTIMMO_LLM_SESSION_MAX_USD || 0.05), accountMaxUsd: Number(env.ALTIMMO_LLM_ACCOUNT_MAX_USD || 0.5), sessionMaxCalls: Number(env.ALTIMMO_LLM_SESSION_MAX_CALLS || 60), ipMaxCallsPerMinute: Number(env.ALTIMMO_LLM_IP_MAX_CALLS_PER_MINUTE || 30),
    safetyMargin: 0.1, timeoutMs: Number(env.ALTIMMO_LLM_TIMEOUT_MS || 45_000),
  };
  Object.defineProperty(config, 'apiKey', { value: () => key, enumerable: false });
  return Object.freeze(config);
}

function publicLlmStatus(config) {
  return { provider: config.provider, model: config.model, enabled: config.enabled, keyConfigured: config.keyConfigured, ready: config.ready, budgetUsd: config.budgetUsd };
}

module.exports = { PROVIDERS, MODELS, OFFICIAL_BASE_URL, resolveLlmConfig, publicLlmStatus };
