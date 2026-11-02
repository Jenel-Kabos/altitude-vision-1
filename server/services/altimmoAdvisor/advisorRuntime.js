'use strict';
// ALTIMMO-AI-INTEGRATION-01 (DeepSeek) — assemblage du conseiller dans le serveur Altimmo.
//
// Une seule instance par processus, créée au premier usage autorisé : mémoire de conversation par compte,
// moteur IA-03 dans le processus, fournisseur (simulé par défaut, DeepSeek sur configuration explicite),
// compteur de coûts relu depuis le registre de l'environnement, agent déterministe de secours.
// La clé du fournisseur n'est lue que par `providerConfig` et n'est jamais renvoyée ni journalisée.
const crypto = require('node:crypto');
const logger = require('../../utils/logger');
const { createSessionStore } = require('./sessionStore');
const { createAgent } = require('./agent');
const { createEngineAdapter, createCachedTools } = require('./engineAdapter');
const { resolveLlmConfig, publicLlmStatus } = require('./llm/providerConfig');
const { createDeepSeekProvider } = require('./llm/deepseekProvider');
const { createMockProvider } = require('./llm/mockProvider');
const { simulatedDecide } = require('./llm/simulatedAdvisor');
const { createCostMeter } = require('./llm/costMeter');
const { createConversationManager } = require('./llm/conversationManager');
const { advisorEnvironment, isLlmStoppedByConfig } = require('../../config/altimmoAdvisor');

const CONVERSATION_ID = /^[A-Za-z0-9-]{8,64}$/;
const OWNER_LENGTH = 21; // 'u' + 20 caractères hexadécimaux
const digest = (prefix, value) => `${prefix}${crypto.createHash('sha256').update(`altimmo-advisor:${value}`).digest('hex').slice(0, 20)}`;

/** Empreinte stable d'un compte : jamais l'identifiant brut dans la mémoire, les journaux ni le registre. */
const accountKey = (userId) => digest('a', String(userId));
/** Clé de session : propre au compte authentifié ; un autre compte ne peut pas la former. */
const sessionKey = (userId, conversationId) => {
  if (typeof conversationId !== 'string' || !CONVERSATION_ID.test(conversationId)) return null;
  return `${digest('u', String(userId))}_${conversationId}`;
};

// Registre persistant (MongoDB) : chargé avant tout appel payant ; toute erreur arrête les appels au fournisseur.
function createMongoLedger({ environment, provider }) {
  const AltimmoAdvisorUsage = require('../../models/AltimmoAdvisorUsage');
  const month = () => new Date().toISOString().slice(0, 7);
  return {
    async load() {
      const doc = await AltimmoAdvisorUsage.findOne({ environment, provider, month: month() }).lean();
      return { month: month(), spentUsd: doc?.spentUsd || 0, calls: doc?.calls || 0, inputTokens: doc?.inputTokens || 0, outputTokens: doc?.outputTokens || 0, bySession: {}, byAccount: doc?.byAccount || {} };
    },
    async record(delta) {
      const inc = { spentUsd: delta.spentUsd, calls: delta.calls, inputTokens: delta.inputTokens, outputTokens: delta.outputTokens, estimatedCalls: delta.estimated ? 1 : 0 };
      if (delta.accountId) { inc[`byAccount.${delta.accountId}.spentUsd`] = delta.spentUsd; inc[`byAccount.${delta.accountId}.calls`] = delta.calls; }
      await AltimmoAdvisorUsage.updateOne({ environment, provider, month: delta.month }, { $inc: inc }, { upsert: true });
    },
  };
}

function createAdvisorRuntime({ env = process.env, engine = null, provider = null, ledger = undefined, log = (entry) => logger.info(`[altimmoAdvisor] ${JSON.stringify(entry)}`) } = {}) {
  const config = resolveLlmConfig(env);
  const environment = advisorEnvironment(env);
  const store = createSessionStore({ maxSessions: 500, maxPerOwner: 3, ownerOf: (id) => id.slice(0, OWNER_LENGTH) });
  const sweeper = setInterval(() => store.sweep(), 60_000);
  sweeper.unref?.();
  const tools = engine || createCachedTools(createEngineAdapter());
  const fallbackAgent = createAgent({ store, tools, narration: 'deterministic' });
  const llmProvider = provider || (config.provider === 'mock'
    ? createMockProvider({ decide: simulatedDecide, model: config.model })
    : createDeepSeekProvider({ config }));
  // Le registre persistant ne concerne que les dépenses réelles ; le fournisseur simulé n'en écrit aucun.
  const persistent = ledger !== undefined ? ledger : (config.provider === 'deepseek' ? createMongoLedger({ environment, provider: config.provider }) : null);

  let stoppedAt = null;
  let meter = null;
  let ledgerState = persistent ? 'pending' : 'none';
  let loading = null;
  const meterOptions = (initialState) => ({
    budgetUsd: config.budgetUsd, model: config.model, safetyMargin: config.safetyMargin, sessionMaxUsd: config.sessionMaxUsd,
    accountMaxUsd: config.accountMaxUsd, sessionMaxCalls: config.sessionMaxCalls, ipMaxCallsPerMinute: config.ipMaxCallsPerMinute, initialState,
    onAlert: (level, spent) => log({ event: 'budget_alert', environment, level, spentUsd: Number(spent.toFixed(6)), budgetUsd: config.budgetUsd }),
    onSettle: (delta) => {
      if (!persistent) return;
      persistent.record(delta).catch((error) => { ledgerState = 'failed'; log({ event: 'ledger_error', environment, errorName: String(error?.name || 'Error').slice(0, 40) }); });
    },
  });
  if (!persistent) meter = createCostMeter(meterOptions(null));

  async function ready() {
    if (!persistent || ledgerState === 'loaded') return;
    // Une écriture du registre a échoué après chargement : arrêt des appels jusqu'au redémarrage (aucun sous-comptage).
    if (meter && ledgerState === 'failed') return;
    if (!loading) {
      loading = persistent.load()
        .then((state) => { meter = createCostMeter(meterOptions(state)); ledgerState = 'loaded'; })
        .catch((error) => { ledgerState = 'failed'; log({ event: 'ledger_error', environment, errorName: String(error?.name || 'Error').slice(0, 40) }); })
        .finally(() => { loading = null; });
    }
    await loading;
  }

  // Compteur de remplacement tant que le registre n'est pas lu : il refuse tout appel (aucune dépense possible).
  const closedMeter = { reserve() { throw Object.assign(new Error('Registre indisponible.'), { code: 'ledger_unavailable' }); }, release() {}, settle() { return 0; }, settleEstimated() { return 0; }, snapshot() { return null; } };
  const currentMeter = { reserve: (...a) => (meter || closedMeter).reserve(...a), release: (...a) => (meter || closedMeter).release(...a), settle: (...a) => (meter || closedMeter).settle(...a), settleEstimated: (...a) => (meter || closedMeter).settleEstimated(...a) };

  const llmAllowed = () => {
    if (stoppedAt || isLlmStoppedByConfig(env)) return 'llm_stopped';
    if (persistent && ledgerState !== 'loaded') return 'ledger_unavailable';
    return true;
  };
  const manager = createConversationManager({ store, engine: tools, provider: llmProvider, config, meter: currentMeter, fallbackAgent, llmAllowed, log });

  return {
    sessionKey, accountKey, store,
    async streamTurn(input, emit, signal, options) { await ready(); return manager.streamTurn(input, emit, signal, options); },
    reset: (key) => store.reset(key),
    conversation: (key) => store.get(key),
    stopLlm() { stoppedAt = stoppedAt || new Date().toISOString(); log({ event: 'llm_stopped', environment }); return stoppedAt; },
    status() {
      const gate = llmAllowed();
      const simulated = llmProvider.simulated === true;
      const mode = gate !== true || (!config.ready && !simulated) ? 'moteur' : simulated ? 'simulé' : 'deepseek';
      return { environment, mode, llm: { ...publicLlmStatus(config), simulated, stopped: gate === 'llm_stopped', ledger: ledgerState } };
    },
    usage() {
      const snap = meter?.snapshot();
      if (!snap) return { environment, provider: config.provider, ledger: ledgerState };
      return { environment, provider: config.provider, model: config.model, simulated: llmProvider.simulated === true, ledger: ledgerState, month: snap.month, spentUsd: Number(snap.spentUsd.toFixed(6)), reservedUsd: Number(snap.reservedUsd.toFixed(6)), budgetUsd: snap.budgetUsd, usedRatio: Number(snap.usedRatio.toFixed(4)), calls: snap.calls, inputTokens: snap.inputTokens, outputTokens: snap.outputTokens, accounts: Object.keys(snap.byAccount || {}).length, pricingSource: snap.pricingSource, pricingRetrievedAt: snap.pricingRetrievedAt };
    },
    close() { clearInterval(sweeper); },
  };
}

let shared = null;
/** Instance du processus (créée à la première requête autorisée). */
const getAdvisorRuntime = () => (shared = shared || createAdvisorRuntime());
/** Tests uniquement : remplace ou réinitialise l'instance partagée. */
const setAdvisorRuntimeForTests = (runtime) => { shared?.close?.(); shared = runtime; };

module.exports = { createAdvisorRuntime, getAdvisorRuntime, setAdvisorRuntimeForTests, sessionKey, accountKey, createMongoLedger };
