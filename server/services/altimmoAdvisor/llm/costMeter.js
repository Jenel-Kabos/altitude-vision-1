'use strict';
// Contrôle des coûts : tarifs lus depuis la configuration officielle relevée, réservation préventive
// avant chaque appel (requêtes concurrentes comprises), règlement à l'usage réel, limites et alertes.
const fs = require('node:fs');

const PRICING_FILE = require('node:path').join(__dirname, '..', '..', '..', 'config', 'altimmoAdvisorPricing.json');
const loadPricing = (file = PRICING_FILE) => JSON.parse(fs.readFileSync(file, 'utf8'));

function isPeak(pricing, date) {
  const day = date.getUTCDay(); const hour = date.getUTCHours();
  return pricing.peakHoursUtc.weekdays.includes(day) && pricing.peakHoursUtc.ranges.some(([from, to]) => hour >= from && hour < to);
}

function priceFor(pricing, model, date = new Date()) {
  const table = pricing.models[model];
  if (!table) throw new Error('Tarif inconnu pour ce modèle.');
  const band = isPeak(pricing, date) ? 'peak' : 'offPeak';
  return { band, inputCacheHit: table.inputCacheHit[band], inputCacheMiss: table.inputCacheMiss[band], output: table.output[band] };
}

const budgetError = (code, message) => Object.assign(new Error(message), { code });
const ALERTS = [0.5, 0.8, 0.95];

// INTEGRATION-01 : `initialState` (registre persistant de l'environnement, relu au démarrage), `onSettle` (delta de
// dépense transmis au registre persistant), `accountMaxUsd` (plafond mensuel par compte authentifié).
function createCostMeter({ budgetUsd = 10, model = 'deepseek-flash', safetyMargin = 0.1, sessionMaxUsd = 0.05, accountMaxUsd = Infinity, sessionMaxCalls = 60, ipMaxCallsPerMinute = 20, pricing = loadPricing(), now = () => new Date(), onAlert = () => {}, onSettle = () => {}, ledgerFile = null, initialState = null } = {}) {
  let state = { month: null, spentUsd: 0, calls: 0, inputTokens: 0, outputTokens: 0, bySession: {}, byAccount: {} };
  if (initialState) state = { ...state, ...structuredClone(initialState) };
  else if (ledgerFile && fs.existsSync(ledgerFile)) state = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  state.byAccount = state.byAccount || {};
  const reservations = new Map(); const ipCalls = new Map(); let next = 0; const fired = new Set(state.alerts || []);
  const monthKey = () => now().toISOString().slice(0, 7);
  const rollMonth = () => { if (state.month !== monthKey()) { state = { month: monthKey(), spentUsd: 0, calls: 0, inputTokens: 0, outputTokens: 0, bySession: {}, byAccount: {} }; fired.clear(); } };
  const save = () => { if (ledgerFile) { state.alerts = [...fired]; fs.writeFileSync(ledgerFile, JSON.stringify(state, null, 1), { mode: 0o600 }); } };
  const reserved = () => [...reservations.values()].reduce((sum, r) => sum + r.estimateUsd, 0);
  const session = (id) => (state.bySession[id] = state.bySession[id] || { calls: 0, spentUsd: 0, inputTokens: 0, outputTokens: 0 });
  const account = (id) => (id ? (state.byAccount[id] = state.byAccount[id] || { calls: 0, spentUsd: 0 }) : null);
  const record = (reservation, delta) => {
    const a = account(reservation?.accountId);
    if (a) Object.assign(a, { calls: a.calls + 1, spentUsd: a.spentUsd + delta.spentUsd });
    try { onSettle({ month: state.month, accountId: reservation?.accountId || null, ...delta }); } catch { /* registre persistant : erreur journalisée par l'appelant */ }
  };

  return {
    reserve({ sessionId, accountId = null, ip = 'local', estimatedInputTokens, maxOutputTokens }) {
      rollMonth();
      const price = priceFor(pricing, model, now());
      const estimateUsd = (estimatedInputTokens * price.inputCacheMiss + maxOutputTokens * price.output) / 1e6;
      const cap = budgetUsd * (1 - safetyMargin);
      if (state.spentUsd + reserved() + estimateUsd >= cap) throw budgetError('budget_exhausted', 'Budget mensuel du moteur de langage atteint.');
      const s = session(sessionId);
      const sessionReserved = [...reservations.values()].filter((r) => r.sessionId === sessionId).reduce((sum, r) => sum + r.estimateUsd, 0);
      if (s.spentUsd + sessionReserved + estimateUsd > sessionMaxUsd) throw budgetError('session_budget_exhausted', 'Budget de cette conversation atteint.');
      if (s.calls >= sessionMaxCalls) throw budgetError('session_calls_exhausted', 'Nombre d’appels de cette conversation atteint.');
      const a = account(accountId);
      const accountReserved = accountId ? [...reservations.values()].filter((r) => r.accountId === accountId).reduce((sum, r) => sum + r.estimateUsd, 0) : 0;
      if (a && a.spentUsd + accountReserved + estimateUsd > accountMaxUsd) throw budgetError('account_budget_exhausted', 'Budget mensuel de ce compte atteint.');
      const minute = Math.floor(now().getTime() / 60_000);
      const key = `${ip}:${minute}`; const count = ipCalls.get(key) || 0;
      if (count >= ipMaxCallsPerMinute) throw budgetError('ip_rate_limited', 'Trop de demandes en une minute.');
      ipCalls.set(key, count + 1);
      for (const k of ipCalls.keys()) if (!k.endsWith(`:${minute}`)) ipCalls.delete(k);
      next += 1; reservations.set(next, { sessionId, accountId, estimateUsd });
      return next;
    },
    release(id) { reservations.delete(id); },
    // Génération interrompue (garde, annulation, flux incomplet) : l'usage n'est pas rapporté, on impute le plafond réservé.
    settleEstimated(id) {
      const reservation = reservations.get(id); reservations.delete(id);
      if (!reservation) return 0;
      rollMonth();
      const cost = reservation.estimateUsd;
      const s = session(reservation.sessionId);
      Object.assign(state, { spentUsd: state.spentUsd + cost, calls: state.calls + 1, estimatedCalls: (state.estimatedCalls || 0) + 1, estimatedUsd: (state.estimatedUsd || 0) + cost });
      Object.assign(s, { calls: s.calls + 1, spentUsd: s.spentUsd + cost });
      record(reservation, { spentUsd: cost, calls: 1, inputTokens: 0, outputTokens: 0, estimated: true });
      for (const level of ALERTS) if (state.spentUsd >= budgetUsd * level && !fired.has(level)) { fired.add(level); onAlert(level, state.spentUsd); }
      save();
      return cost;
    },
    settle(id, usage = {}) {
      const reservation = reservations.get(id); reservations.delete(id);
      rollMonth();
      const price = priceFor(pricing, model, now());
      const hit = Number(usage.prompt_cache_hit_tokens || 0);
      const miss = Number(usage.prompt_cache_miss_tokens ?? Math.max(0, Number(usage.prompt_tokens || 0) - hit));
      const out = Number(usage.completion_tokens || 0);
      const cost = (hit * price.inputCacheHit + miss * price.inputCacheMiss + out * price.output) / 1e6;
      const s = session(reservation?.sessionId || 'inconnue');
      Object.assign(state, { spentUsd: state.spentUsd + cost, calls: state.calls + 1, inputTokens: state.inputTokens + hit + miss, outputTokens: state.outputTokens + out });
      Object.assign(s, { calls: s.calls + 1, spentUsd: s.spentUsd + cost, inputTokens: s.inputTokens + hit + miss, outputTokens: s.outputTokens + out });
      record(reservation, { spentUsd: cost, calls: 1, inputTokens: hit + miss, outputTokens: out, estimated: false });
      for (const level of ALERTS) if (state.spentUsd >= budgetUsd * level && !fired.has(level)) { fired.add(level); onAlert(level, state.spentUsd); }
      save();
      return cost;
    },
    snapshot() { rollMonth(); return { estimatedCalls: 0, estimatedUsd: 0, ...structuredClone(state), reservedUsd: reserved(), budgetUsd, usedRatio: budgetUsd ? state.spentUsd / budgetUsd : 1, pricingSource: pricing.source, pricingRetrievedAt: pricing.retrievedAt }; },
  };
}

module.exports = { loadPricing, isPeak, priceFor, createCostMeter };
