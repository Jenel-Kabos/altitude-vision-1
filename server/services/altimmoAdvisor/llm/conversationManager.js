'use strict';
// Gestionnaire de conversation AI-AGENT-03 : le modèle (DeepSeek ou simulé) dialogue et demande des
// outils ; le serveur valide, exécute IA-03, garde la mémoire transactionnelle, filtre le texte diffusé,
// maîtrise le coût et bascule sur l'agent déterministe d'AI-AGENT-02 en cas d'indisponibilité.
const crypto = require('node:crypto');
const { interpretUtterance, normalize } = require('../utteranceInterpreter');
const { nextDialogueAction, FORBIDDEN_COMMERCIAL } = require('../dialoguePolicy');
const { applyOperations, addMotivations, describeState, describeFilters, LIMITS } = require('../conversationState');
const { createOutputGuard, composeFallback, describeChanges } = require('../groundedNarrator');
const { TOOL_DEFINITIONS, createToolRunner } = require('./tools');
const { SYSTEM_RULES, memoryBlock } = require('./prompts');
const { redact } = require('./privacy');

const aborted = () => Object.assign(new Error('Tour annulé.'), { name: 'AbortError' });
const FALLBACK_CODES = new Set(['disabled', 'key_missing', 'auth_failed', 'insufficient_balance', 'invalid_request', 'provider_rate_limited', 'provider_error', 'provider_overloaded', 'network', 'timeout', 'incomplete', 'malformed', 'content_filtered', 'budget_exhausted', 'session_budget_exhausted', 'account_budget_exhausted', 'session_calls_exhausted', 'ip_rate_limited', 'llm_stopped', 'ledger_unavailable']);
const NOTICE = {
  budget_exhausted: 'Le conseiller conversationnel avancé a atteint son budget : je vous réponds avec le moteur Altimmo seul.',
  session_budget_exhausted: 'Cette conversation a atteint sa limite d’usage du conseiller avancé : je poursuis avec le moteur Altimmo seul.',
  session_calls_exhausted: 'Cette conversation a atteint sa limite d’usage du conseiller avancé : je poursuis avec le moteur Altimmo seul.',
  ip_rate_limited: 'Beaucoup de demandes en peu de temps : je vous réponds avec le moteur Altimmo seul.',
  llm_stopped: 'Le conseiller avancé est momentanément arrêté : je vous réponds avec le moteur Altimmo seul.',
  ledger_unavailable: 'Le conseiller avancé est momentanément indisponible : je vous réponds avec le moteur Altimmo seul.',
  account_budget_exhausted: 'Votre compte a atteint sa limite d’usage mensuelle du conseiller avancé : je poursuis avec le moteur Altimmo seul.',
};
const userIdOf = (sessionId) => `alt_${crypto.createHash('sha256').update(String(sessionId)).digest('hex').slice(0, 24)}`;
const estimateTokens = (messages, tools) => Math.ceil((JSON.stringify(messages).length + JSON.stringify(tools).length) * 0.35);

function createConversationManager({ store, engine, provider, config, meter, fallbackAgent, llmAllowed = () => true, now = () => performance.now(), debug = false, log = () => {} }) {
  const queues = new Map();

  function contextMessages(state, history, text, extracted) {
    let budget = config.historyChars; const recent = [];
    for (const m of [...history].slice(-config.historyMessages).reverse()) { const content = redact(m.content).slice(0, 1200); if (budget - content.length < 0) break; budget -= content.length; recent.unshift({ role: m.role, content }); }
    return [{ role: 'system', content: `${SYSTEM_RULES}\n\n${memoryBlock(state, extracted)}` }, ...recent, { role: 'user', content: redact(text) }];
  }

  async function delegate(input, emit, signal, metrics, reason) {
    metrics.mode = 'secours'; metrics.fallbackReason = reason;
    const result = await fallbackAgent.streamTurn(input, emit, signal);
    const notice = NOTICE[reason];
    return { ...result, reply: notice ? `${notice} ${result.reply}` : result.reply, metrics: { ...result.metrics, ...metrics } };
  }

  // `llmAllowed()` : interrupteur d'arrêt immédiat des nouveaux appels au fournisseur (lu à chaque tour).
  async function processTurn(input, emit, signal, ip, accountId) {
    const text = typeof input.message === 'string' ? input.message.trim() : '';
    if (!text || text.length > 1000) throw new Error('Message utilisateur invalide.');
    if (signal?.aborted) throw aborted();
    const startedAt = now();
    const metrics = { mode: provider.simulated ? 'simulé' : 'deepseek', provider: provider.name, model: provider.model, llmCalls: 0, toolCalls: 0, costUsd: 0, inputTokens: 0, outputTokens: 0, cacheHitTokens: 0 };

    // Refus commercial avant tout appel externe : aucun coût, aucun risque.
    if (FORBIDDEN_COMMERCIAL.test(normalize(text))) { metrics.mode = 'règle'; return fallbackAgent.streamTurn(input, emit, signal).then((r) => ({ ...r, metrics: { ...r.metrics, ...metrics } })); }
    if (!config.ready && !provider.simulated) return delegate(input, emit, signal, metrics, config.enabled ? 'key_missing' : 'disabled');
    const gate = llmAllowed();
    if (gate !== true) return delegate(input, emit, signal, metrics, gate);

    const draft = store.beginTurn(input.sessionId);
    const history = draft.messages;
    const before = draft.state;
    let emittedText = '';
    let stage = 'initialisation';
    try {
      emit('status', { step: 'analyse', label: 'Le conseiller réfléchit à votre demande' });
      // Extraction déterministe des critères explicites (montants, quartiers…) : précise et gratuite.
      const interp = interpretUtterance(text, before);
      const policy = nextDialogueAction(before, interp, text);
      let state = before; const extracted = [];
      for (const op of policy.operations) { try { state = applyOperations(state, [op]); extracted.push(op); } catch { /* hors catalogue */ } }
      state = addMotivations(state, interp.motivations);
      if (policy.pending) state.pendingRelaxation = policy.pending;
      draft.state = state;
      metrics.intent = interp.intent || null; // traçabilité de la certification (aucune donnée client)

      // Exploration du catalogue décidée par la politique serveur (intention du message ou mode actif), jamais par le modèle.
      const generalSearch = policy.general === true;
      const runner = createToolRunner({ engine, draft, userText: text, interp, deterministicPaths: extracted.map((o) => o.path), allowedAction: policy.action, generalSearch, maxCalls: config.maxToolCallsPerTurn, signal, emit: (event, data) => emit(event, data) });
      const messages = contextMessages(draft.state, history, text, extracted);
      const facts = runner.facts;
      const contextNow = () => {
        const kind = facts.comparison ? 'compare' : facts.results?.length ? 'results' : facts.evaluated?.length ? 'advise' : facts.proposal ? 'proposal' : facts.searched ? 'no_results' : 'clarify';
        return { kind, general: generalSearch, before, userText: text, state: draft.state, results: facts.results?.length ? facts.results : facts.evaluated || [], catalog: facts.catalog, comparison: facts.comparison, proposal: facts.proposal, changes: describeChanges(extracted, before), fits: Object.fromEntries((facts.results || []).map((r) => [r.listing.id, r.fit])) };
      };
      // Recherche imposée par la politique serveur : exécutée avant le premier appel du modèle, qui rédige sur ce résultat
      // (sinon il répond de mémoire avec des fiches que le changement de filtre a retirées des faits vérifiés).
      let preSearched = false;
      if (policy.action === 'search') {
        stage = 'tool:search_properties';
        emit('status', { step: 'outil', label: 'Recherche dans les annonces publiées' });
        const result = await runner.ensureSearch();
        if (signal?.aborted) throw aborted();
        metrics.toolCalls += 1; preSearched = true;
        messages.push({ role: 'assistant', content: '', tool_calls: [{ id: 'server_search', type: 'function', function: { name: 'search_properties', arguments: '{}' } }] });
        messages.push({ role: 'tool', tool_call_id: 'server_search', content: JSON.stringify(result).slice(0, 6000) });
      }
      const parts = []; let violation = null; let truncated = false;
      for (let round = 0; round <= config.maxToolRounds; round += 1) {
        const lastRound = round === config.maxToolRounds || runner.calls() >= config.maxToolCallsPerTurn;
        const tools = lastRound ? [] : TOOL_DEFINITIONS;
        const reservation = meter.reserve({ sessionId: input.sessionId, accountId, ip, estimatedInputTokens: estimateTokens(messages, tools), maxOutputTokens: config.maxOutputTokens });
        const ctx = contextNow();
        // Chaque fragment est filtré dès son arrivée ; une violation coupe la génération (coût évité).
        const guard = createOutputGuard(ctx, { coverage: false, phantomOffer: false });
        const stop = new AbortController();
        const combined = signal ? AbortSignal.any([signal, stop.signal]) : stop.signal;
        const roundStarted = now();
        let out;
        try {
          stage = `provider:${round}`;
          emit('status', { step: round ? 'redaction' : 'analyse', label: round ? 'Rédaction de la réponse' : 'Le conseiller réfléchit à votre demande' });
          out = await provider.chatStream({ messages, tools, toolChoice: lastRound ? 'none' : 'auto', signal: combined, userId: userIdOf(input.sessionId), maxTokens: config.maxOutputTokens, onContent: (piece) => {
            const safe = guard.push(piece);
            if (safe) { if (metrics.firstDeltaMs === undefined) metrics.firstDeltaMs = Math.round(now() - startedAt); emittedText += safe; emit('delta', { text: safe }); }
            if (guard.violation) stop.abort();
          } });
        } catch (error) {
          // Une génération commencée puis interrompue est facturée par le fournisseur : imputer le plafond réservé.
          const started = stop.signal.aborted || signal?.aborted || ['timeout', 'incomplete', 'malformed', 'content_filtered'].includes(error.code);
          if (started) metrics.costUsd += meter.settleEstimated(reservation); else meter.release(reservation);
          if (started) metrics.estimatedCalls = (metrics.estimatedCalls || 0) + 1;
          if (stop.signal.aborted && !signal?.aborted) { violation = guard.violation; metrics.llmCalls += 1; break; }
          throw error;
        }
        const cost = meter.settle(reservation, out.usage || {});
        stage = `narration:${round}`;
        Object.assign(metrics, { llmCalls: metrics.llmCalls + 1, costUsd: metrics.costUsd + cost, inputTokens: metrics.inputTokens + Number(out.usage?.prompt_tokens || 0), outputTokens: metrics.outputTokens + Number(out.usage?.completion_tokens || 0), cacheHitTokens: metrics.cacheHitTokens + Number(out.usage?.prompt_cache_hit_tokens || 0) });
        if (metrics.firstModelMs === undefined) metrics.firstModelMs = Math.round(now() - roundStarted);
        const tail = guard.end();
        if (guard.violation) { violation = guard.violation; break; }
        if (tail) { emittedText += tail; emit('delta', { text: tail }); }
        if (guard.text.trim()) parts.push(guard.text.trim());
        if (out.finishReason === 'tool_calls' && out.toolCalls.length && !lastRound) {
          messages.push({ role: 'assistant', content: out.content || '', tool_calls: out.toolCalls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: c.arguments } })) });
          for (const call of out.toolCalls) {
            emit('status', { step: 'outil', label: { search_properties: 'Recherche dans les annonces publiées', compare_properties: 'Comparaison des fiches publiées', propose_alternative: 'Recherche d’un compromis vérifiable', apply_alternative: 'Application du compromis et nouvelle recherche' }[call.name] || 'Vérification des informations' });
            stage = `tool:${call.name}`;
            const { result } = await runner.run(call);
            if (signal?.aborted) throw aborted();
            // Seuls les outils réellement exécutés sont comptés (pas les doublons ni les refus au-delà du plafond).
            if (!result.deja_execute && result.erreur !== 'limite_appels') metrics.toolCalls += 1;
            log({ event: 'tool', tool: call.name, ok: !result.erreur, error: result.erreur || null });
            messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result).slice(0, 6000) });
          }
          if (emittedText && !/\s$/.test(emittedText)) { emittedText += ' '; emit('delta', { text: ' ' }); }
          continue;
        }
        if (out.finishReason === 'length') truncated = true;
        break;
      }
      if (signal?.aborted) throw aborted();

      let forcedSearch = false;
      if (policy.action === 'search' && !facts.searched) { stage = 'tool:search_properties'; await runner.ensureSearch(); metrics.toolCalls += 1; forcedSearch = true; }
      const ctx = contextNow();
      metrics.preSearched = preSearched; metrics.results = facts.results?.length || 0; metrics.alternatives = facts.catalog.length;
      stage = 'finalisation';
      let reply = parts.join(' ').trim();
      let narration = 'model';
      // Recherche imposée sans aucun résultat : la réponse du modèle reste valable si elle passe le garde complet (aucune offre inventée).
      let forcedReplaced = forcedSearch;
      if ((forcedSearch || preSearched) && reply && !violation && !truncated && !facts.results?.length) {
        const recheck = createOutputGuard(ctx, { coverage: false, phantomOffer: true });
        recheck.push(reply); recheck.end();
        forcedReplaced = Boolean(recheck.violation);
      }
      if (violation || !reply || truncated || forcedReplaced) {
        narration = 'fallback';
        const decision = nextDialogueAction(draft.state, interpretUtterance(text, before), text);
        reply = composeFallback({ ...ctx, question: ctx.kind === 'clarify' ? decision.question : undefined, summary: describeState(draft.state) }) || 'Pouvez-vous préciser votre projet immobilier ?';
        metrics.narrationViolation = violation || (truncated ? 'réponse tronquée' : forcedReplaced ? 'recherche imposée par la politique serveur' : 'réponse vide');
        if (debug) metrics.rejectedNarration = parts.join(' ');
      }
      if (signal?.aborted) throw aborted();
      if (ctx.kind === 'clarify' && reply.includes('?')) { draft.state.lastQuestion = policy.questionKey || 'llm'; if (policy.questionKey) draft.state.asked = [...draft.state.asked.filter((k) => k !== policy.questionKey), policy.questionKey]; }
      draft.state.asked = draft.state.asked.slice(-LIMITS.asked);
      Object.assign(metrics, { narration, totalMs: Math.round(now() - startedAt), costUsd: Number(metrics.costUsd.toFixed(8)) });
      store.commitTurn(input.sessionId, draft, { user: text, assistant: reply });
      log({ event: 'turn', mode: metrics.mode, llmCalls: metrics.llmCalls, toolCalls: metrics.toolCalls, inputTokens: metrics.inputTokens, outputTokens: metrics.outputTokens, costUsd: metrics.costUsd, narration, totalMs: metrics.totalMs });
      const cards = (facts.results?.length ? facts.results : facts.evaluated || []).map((r) => ({ listing: r.listing }));
      const { lastResults: _lastResults, criteriaHistory: _criteriaHistory, ...publicState } = structuredClone(draft.state);
      const status = facts.comparison ? 'comparison' : facts.proposal ? 'alternative_proposed' : cards.length ? 'success' : facts.searched ? 'no_results' : 'needs_clarification';
      return { status, reply, retract: narration === 'fallback' && emittedText.length > 0, criteria: describeFilters(draft.state), state: publicState, cards, fits: ctx.fits, comparison: facts.comparison, proposal: facts.proposal ? { id: facts.proposal.id, label: facts.proposal.label, preserved: facts.proposal.preserved, rationale: facts.proposal.rationale, count: facts.proposal.count } : null, metrics };
    } catch (error) {
      store.abortTurn(input.sessionId, draft.token);
      if (signal?.aborted || error.name === 'AbortError') throw aborted();
      const code = error.code && FALLBACK_CODES.has(error.code) ? error.code : 'provider_error';
      log({ event: 'fallback', reason: code, stage, errorName: String(error?.name || 'Error').slice(0, 40) });
      return delegate(input, emit, signal, metrics, code);
    }
  }

  return {
    streamTurn(input, emit = () => {}, signal, { ip = 'local', accountId = null } = {}) {
      const previous = queues.get(input.sessionId) || Promise.resolve();
      const current = previous.catch(() => {}).then(() => processTurn(input, emit, signal, ip, accountId));
      const settled = current.catch(() => {}).finally(() => { if (queues.get(input.sessionId) === settled) queues.delete(input.sessionId); });
      queues.set(input.sessionId, settled);
      return current;
    },
    turn(input, signal) { return this.streamTurn(input, () => {}, signal); },
    reset(sessionId) { return store.reset(sessionId); },
    pendingTurns() { return queues.size; },
  };
}

module.exports = { createConversationManager };
