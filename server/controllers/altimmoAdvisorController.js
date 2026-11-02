// ALTIMMO-AI-INTEGRATION-01 (DeepSeek) — API du conseiller conversationnel Altimmo (comptes internes autorisés).
//
// GET    /api/altimmo/advisor/status                                   → disponibilité pour le compte connecté
// POST   /api/altimmo/advisor/conversations/:conversationId/turns      { message, turnId } — flux SSE si
//        `Accept: text/event-stream`, sinon réponse JSON complète (transport mobile)
// DELETE /api/altimmo/advisor/conversations/:conversationId/turns/:turnId → annulation du tour en cours
// GET    /api/altimmo/advisor/conversations/:conversationId            → reprise (messages et filtres actifs)
// DELETE /api/altimmo/advisor/conversations/:conversationId            → réinitialisation
// GET    /api/altimmo/advisor/usage                                    → consommation de l'environnement
// POST   /api/altimmo/advisor/llm/stop                                 → arrêt immédiat des appels au fournisseur
//
// Toutes les routes exigent une session (`protect`) puis la décision serveur `checkAdvisorAccess` :
// interrupteur global, environnement, compte explicitement autorisé. Le conseiller ne lit que des
// annonces publiques, ne publie, ne réserve, ne paie et ne contacte rien. Le texte des messages n'est
// jamais journalisé.
const logger = require('../utils/logger');
const { checkAdvisorAccess, ADVISOR_DENIALS } = require('../config/altimmoAdvisor');
const { getAdvisorRuntime } = require('../services/altimmoAdvisor/advisorRuntime');
const { openSse } = require('../services/altimmoAdvisor/sse');
const { describeFilters } = require('../services/altimmoAdvisor/conversationState');

const MAX_MESSAGE_LENGTH = 1000;
const TURN_ID = /^[A-Za-z0-9_-]{1,64}$/;
const TURN_TIMEOUT_MS = 90_000;
const TURN_KEYS = new Set(['message', 'turnId']);
const active = new Map();

const fail = (res, status, code, message) => res.status(status).json({ status: 'fail', code, message });

/** Middleware : refuse avant toute lecture si le compte n'est pas autorisé. */
function requireAdvisorAccess(req, res, next) {
  const decision = checkAdvisorAccess(req.user);
  if (decision.allowed) return next();
  const denial = ADVISOR_DENIALS[decision.code];
  return fail(res, denial.status, decision.code, denial.message);
}

function keyOf(req, res) {
  const key = getAdvisorRuntime().sessionKey(req.user._id, req.params.conversationId);
  if (!key) fail(res, 400, 'ADVISOR_INVALID_REQUEST', 'Requête invalide.');
  return key;
}

// Métriques transmises au client : mode et coût du tour, jamais de texte rejeté ni de détail interne.
const publicMetrics = (metrics = {}) => ({
  mode: metrics.mode || null, narration: metrics.narration || null, fallbackReason: metrics.fallbackReason || null,
  llmCalls: metrics.llmCalls || 0, toolCalls: metrics.toolCalls || 0, totalMs: metrics.totalMs ?? null, firstDeltaMs: metrics.firstDeltaMs ?? null,
});
const publicResult = (result) => ({
  status: result.status, reply: result.reply, retract: Boolean(result.retract), criteria: result.criteria, state: result.state,
  cards: result.cards || [], fits: result.fits || {}, comparison: result.comparison || null, proposal: result.proposal || null,
  metrics: publicMetrics(result.metrics),
});

const status = (req, res) => {
  const decision = checkAdvisorAccess(req.user);
  if (!decision.allowed) return res.status(200).json({ status: 'success', data: { available: false } });
  return res.status(200).json({ status: 'success', data: { available: true, ...getAdvisorRuntime().status() } });
};

async function turn(req, res) {
  const key = keyOf(req, res);
  if (!key) return undefined;
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : null;
  if (!body || Object.keys(body).some((field) => !TURN_KEYS.has(field)) || typeof body.message !== 'string' || !body.message.trim()
    || body.message.length > MAX_MESSAGE_LENGTH || typeof body.turnId !== 'string' || !TURN_ID.test(body.turnId)) {
    return fail(res, 400, 'ADVISOR_INVALID_REQUEST', 'Requête invalide.');
  }
  const activeKey = `${key}:${body.turnId}`;
  if (active.has(activeKey)) return fail(res, 409, 'ADVISOR_TURN_IN_PROGRESS', 'Ce message est déjà en cours de traitement.');
  const controller = new AbortController();
  active.set(activeKey, controller);
  const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(TURN_TIMEOUT_MS)]);
  res.on('close', () => { if (!res.writableEnded) controller.abort(); });
  const runtime = getAdvisorRuntime();
  const options = { ip: req.ip || 'inconnue', accountId: runtime.accountKey(req.user._id) };
  const streaming = String(req.headers.accept || '').includes('text/event-stream');
  const sse = streaming ? openSse(res) : null;
  try {
    const result = await runtime.streamTurn({ sessionId: key, message: body.message }, (event, data) => sse?.send(event, data), signal, options);
    if (sse) sse.send('final', publicResult(result));
    else res.status(200).json({ status: 'success', data: publicResult(result) });
  } catch (error) {
    const cancelled = signal.aborted || error?.name === 'AbortError';
    if (!cancelled) logger.error(`[altimmoAdvisor] échec ${String(error?.name || 'Error').slice(0, 40)}`);
    const code = cancelled ? 'ADVISOR_TURN_CANCELLED' : 'ADVISOR_UNAVAILABLE';
    const message = cancelled ? 'Demande annulée. Vos critères validés sont conservés.' : 'Le conseiller a rencontré une erreur. Vos critères validés sont conservés ; réessayez.';
    if (sse) sse.send('error', { code, message });
    else if (!res.headersSent && !res.destroyed) fail(res, cancelled ? 499 : 503, code, message);
  } finally {
    active.delete(activeKey);
    sse?.close();
  }
  return undefined;
}

const cancel = (req, res) => {
  const key = keyOf(req, res);
  if (!key) return undefined;
  const controller = typeof req.params.turnId === 'string' && TURN_ID.test(req.params.turnId) ? active.get(`${key}:${req.params.turnId}`) : null;
  if (!controller) return fail(res, 404, 'ADVISOR_TURN_NOT_FOUND', 'Aucune demande en cours.');
  controller.abort();
  return res.status(202).json({ status: 'success', data: { cancelled: true } });
};

const conversation = (req, res) => {
  const key = keyOf(req, res);
  if (!key) return undefined;
  const session = getAdvisorRuntime().conversation(key);
  if (!session) return fail(res, 404, 'ADVISOR_CONVERSATION_NOT_FOUND', 'Conversation expirée ou inexistante.');
  const { lastResults, criteriaHistory: _history, ...state } = session.state;
  return res.status(200).json({
    status: 'success',
    data: { messages: session.messages, criteria: describeFilters(session.state), state, cards: (lastResults || []).map((listing) => ({ listing })), updatedAt: new Date(session.updatedAt).toISOString() },
  });
};

const reset = (req, res) => {
  const key = keyOf(req, res);
  if (!key) return undefined;
  for (const [activeKey, controller] of active) if (activeKey.startsWith(`${key}:`)) controller.abort();
  getAdvisorRuntime().reset(key);
  return res.status(204).end();
};

const usage = (req, res) => res.status(200).json({ status: 'success', data: getAdvisorRuntime().usage() });

// Arrêt d'exécution : sens unique (aucune API ne réactive le fournisseur ; un redémarrage ou la configuration le fait).
const stopLlm = (req, res) => {
  if (req.user?.role !== 'Admin') return fail(res, 403, 'ADVISOR_ACCESS_DENIED', 'Action réservée aux administrateurs autorisés.');
  return res.status(200).json({ status: 'success', data: { stoppedAt: getAdvisorRuntime().stopLlm() } });
};

module.exports = { requireAdvisorAccess, status, turn, cancel, conversation, reset, usage, stopLlm, MAX_MESSAGE_LENGTH, TURN_TIMEOUT_MS };
