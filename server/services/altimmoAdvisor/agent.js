'use strict';
// Agent conversationnel déterministe (AI-AGENT-02 → INTENT-FIX) : interprétation, politique de dialogue,
// outils IA-03 fermés, narration fondée en flux. La mémoire n'est validée qu'en fin de tour.
// C'est le moteur de secours du conseiller : utilisé sans DeepSeek (désactivé, budget, panne).
const { interpretUtterance } = require('./utteranceInterpreter');
const { nextDialogueAction } = require('./dialoguePolicy');
const { proposeRelaxation, proposeMoreSpace } = require('./alternativePlanner');
const { applyOperations, addMotivations, buildSearchQuery, variantCriteria, describeState, describeFilters, searchVariants, evaluateListing, LIMITS } = require('./conversationState');
const { createNarrator, describeChanges, REFUSAL } = require('./groundedNarrator');
const { filterGeneralListing } = require('./llm/tools');

const MAX_RESULTS = 5;
const STATUS = { rate_limited: 'rate_limited', clarify: 'needs_clarification', respond: 'needs_clarification', refuse: 'refused', results: 'success', advise: 'success', declined: 'success', compare: 'comparison', proposal: 'alternative_proposed', no_results: 'no_results', no_space: 'no_results', tool_unavailable: 'tool_unavailable' };

class TurnAborted extends Error { constructor() { super('Tour annulé.'); this.name = 'AbortError'; } }
const checkpoint = (signal) => { if (signal?.aborted) throw new TurnAborted(); };

function applySafely(state, operations) {
  let next = state; const applied = [];
  for (const operation of operations) {
    try { next = applyOperations(next, [operation]); applied.push(operation); } catch { /* opération hors catalogue ignorée */ }
  }
  return { state: next, applied };
}

const publicState = (state) => { const { lastResults: _lastResults, criteriaHistory: _criteriaHistory, ...rest } = state; return structuredClone(rest); };
const remember = (list, value, limit) => [...list.filter((item) => item !== value), value].slice(-limit);

function createAgent({ store, tools, narration = 'deterministic', narrator = createNarrator({ llm: null, mode: narration }), now = () => performance.now(), debug = false }) {
  if (!store || !tools) throw new Error('Dépendances agent manquantes.');
  const queues = new Map();

  // Agent de secours : interprétation déterministe uniquement (aucun modèle n'est appelé ici).
  async function understand(text, state) {
    return interpretUtterance(text, state);
  }

  // IA-03 bloque une recherche sans opération : on interroge alors location ET achat, sans rien supposer.
  async function searchState(state, signal, general = false) {
    if (general) { const all = await tools.listPublished({ signal }); return { ...all, items: (all.items || []).filter((item) => filterGeneralListing(state, item.listing)) }; }
    const variants = searchVariants(state, { transactions: ['RENT', 'BUY'] });
    const results = [];
    for (const variant of variants) { results.push(await tools.searchPublished({ query: buildSearchQuery(variant), criteria: variantCriteria(variant), signal })); checkpoint(signal); }
    const seen = new Set();
    const items = results.flatMap((result) => result.items || []).filter((item) => !seen.has(item.listing.id) && seen.add(item.listing.id));
    return { status: items.length ? 'success' : results[0]?.status, criteria: variants.length === 1 ? results[0]?.criteria : null, items, warnings: results.flatMap((r) => r.warnings || []) };
  }

  async function search(state, signal, metrics, general = false) {
    const started = now();
    const result = await searchState(state, signal, general);
    metrics.toolMs = (metrics.toolMs || 0) + Math.round(now() - started);
    return { ...result, items: result.items.slice(0, MAX_RESULTS) };
  }

  async function processTurn({ sessionId, message }, emit, signal) {
    const text = typeof message === 'string' ? message.trim() : '';
    if (!text || text.length > 1000) throw new Error('Message utilisateur invalide.');
    checkpoint(signal);
    const startedAt = now();
    const metrics = { model: null };
    const draft = store.beginTurn(sessionId);
    try {
      emit('status', { step: 'analyse', label: 'Analyse de votre demande' });
      const before = draft.state;
      const interp = await understand(text, before);
      const decision = nextDialogueAction(before, interp, text);
      let { state, applied } = applySafely(before, decision.operations);
      state = addMotivations(state, interp.motivations);
      if (decision.clearPending) state.pendingRelaxation = null;
      const ctx = { kind: 'clarify', before, changes: describeChanges(applied, before) };
      let cards = []; let comparison = null; let proposal = null; let fits = {};

      const present = async (result, mode) => {
        cards = result.items;
        state.certified = result.criteria && typeof result.criteria === 'object' ? structuredClone(result.criteria) : null;
        state.lastResults = cards.map((item) => item.listing);
        state.proposedIds = [...new Set([...state.proposedIds, ...cards.map((item) => item.listing.id)])].slice(-LIMITS.proposedIds);
        const entries = cards.map((item) => ({ listing: item.listing, fit: evaluateListing(state, item.listing) }));
        fits = Object.fromEntries(entries.map((entry) => [entry.listing.id, entry.fit]));
        if (cards.length) {
          Object.assign(ctx, { kind: mode === 'advise' ? 'advise' : 'results', results: entries });
          if (state.proximity.school && !state.asked.includes('school_tradeoff') && mode !== 'advise') {
            ctx.followUp = 'La proximité de l’école est-elle indispensable, ou accepteriez-vous un trajet un peu plus long pour une maison plus spacieuse ?';
            state.asked = remember(state.asked, 'school_tradeoff', LIMITS.asked);
          }
          emit('facts', { cards, fits, criteria: describeFilters(state) });
          return;
        }
        emit('status', { step: 'alternatives', label: 'Recherche d’un compromis vérifiable' });
        proposal = await proposeRelaxation(state, (_query, relaxed) => searchState(relaxed, signal));
        checkpoint(signal);
        if (proposal) { state.pendingRelaxation = proposal; Object.assign(ctx, { kind: 'proposal', proposal }); }
        else ctx.kind = 'no_results';
      };

      try {
        switch (decision.action) {
          case 'refuse': ctx.kind = 'refuse'; break;
          case 'clarify':
            Object.assign(ctx, { kind: 'clarify', question: decision.question });
            if (decision.questionKey) { state.asked = remember(state.asked, decision.questionKey, LIMITS.asked); state.lastQuestion = decision.questionKey; }
            if (decision.pending) state.pendingRelaxation = decision.pending;
            break;
          case 'respond': Object.assign(ctx, { kind: 'respond', question: decision.question }); break;
          case 'decline_relaxation':
            state.rejectedRelaxations = remember(state.rejectedRelaxations, decision.relaxation.id, LIMITS.rejected);
            state.pendingRelaxation = null;
            Object.assign(ctx, { kind: 'declined', relaxation: decision.relaxation });
            break;
          case 'apply_relaxation':
            state.acceptedRelaxations = remember(state.acceptedRelaxations, decision.relaxation.id, LIMITS.rejected);
            state.pendingRelaxation = null;
            ctx.changes = describeChanges(applied, before); ctx.accepted = true;
          // fallthrough : relance immédiate de la recherche
          case 'search': {
            emit('status', { step: 'recherche', label: 'Recherche dans les annonces publiées' });
            const general = decision.general === true; ctx.general = general;
            await present(await search(state, signal, metrics, general), decision.mode);
            break;
          }
          case 'advise': {
            const entries = state.lastResults.map((listing) => ({ listing, fit: evaluateListing(state, listing) }));
            cards = state.lastResults.map((listing) => ({ listing }));
            fits = Object.fromEntries(entries.map((entry) => [entry.listing.id, entry.fit]));
            Object.assign(ctx, { kind: 'advise', results: entries });
            emit('facts', { cards, fits, criteria: describeFilters(state) });
            break;
          }
          case 'compare': {
            emit('status', { step: 'comparaison', label: 'Comparaison des fiches publiées' });
            const started = now();
            comparison = await tools.comparePublished(decision.propertyIds, { signal });
            metrics.toolMs = Math.round(now() - started);
            checkpoint(signal);
            fits = Object.fromEntries((comparison.items || []).map((item) => [item.listing.id, evaluateListing(state, item.listing)]));
            Object.assign(ctx, { kind: 'compare', comparison, fits });
            emit('facts', { comparison, fits, criteria: describeFilters(state) });
            break;
          }
          case 'propose_space':
            emit('status', { step: 'alternatives', label: 'Recherche de biens plus spacieux' });
            proposal = await proposeMoreSpace(state, (_query, relaxed) => searchState(relaxed, signal));
            checkpoint(signal);
            if (proposal) { state.pendingRelaxation = proposal; Object.assign(ctx, { kind: 'proposal', proposal }); } else ctx.kind = 'no_space';
            break;
          default: Object.assign(ctx, { kind: 'respond', question: decision.question });
        }
      } catch (error) {
        if (error instanceof TurnAborted || signal?.aborted) throw new TurnAborted();
        ctx.kind = error.code === 'rate_limited' ? 'rate_limited' : 'tool_unavailable'; cards = []; comparison = null; proposal = null;
      }

      Object.assign(ctx, { state, summary: describeState(state) });
      emit('status', { step: 'redaction', label: 'Rédaction de la réponse' });
      const narrationStarted = now();
      let firstDeltaMs = null;
      const narration = ctx.kind === 'refuse'
        ? (emit('delta', { text: REFUSAL }), { text: REFUSAL, mode: 'deterministic', metrics: null })
        : await narrator.narrate(ctx, { signal, onDelta: (chunk) => { if (firstDeltaMs === null) firstDeltaMs = Math.round(now() - startedAt); emit('delta', { text: chunk }); } });
      checkpoint(signal);
      if (debug && narration.rejected) metrics.rejectedNarration = narration.rejected;
      Object.assign(metrics, { narration: narration.mode, narrationViolation: narration.violation || null, modelUnavailable: narration.error === 'model_unavailable', narrationMs: Math.round(now() - narrationStarted), firstDeltaMs, llm: narration.metrics, totalMs: Math.round(now() - startedAt) });

      store.commitTurn(sessionId, { ...draft, state }, { user: text, assistant: narration.text });
      return { status: STATUS[ctx.kind] || 'success', reply: narration.text, criteria: describeFilters(state), state: publicState(state), cards, fits, comparison, proposal: proposal ? { id: proposal.id, label: proposal.label, preserved: proposal.preserved, rationale: proposal.rationale, count: proposal.count } : null, metrics };
    } catch (error) {
      store.abortTurn(sessionId, draft.token);
      throw error;
    }
  }

  return {
    streamTurn(input, emit = () => {}, signal) {
      const previous = queues.get(input.sessionId) || Promise.resolve();
      const current = previous.catch(() => {}).then(() => processTurn(input, emit, signal));
      const settled = current.catch(() => {}).finally(() => { if (queues.get(input.sessionId) === settled) queues.delete(input.sessionId); });
      queues.set(input.sessionId, settled);
      return current;
    },
    turn(input, signal) { return this.streamTurn(input, () => {}, signal); },
    reset(sessionId) { return store.reset(sessionId); },
    pendingTurns() { return queues.size; },
  };
}

module.exports = { TurnAborted, createAgent };
