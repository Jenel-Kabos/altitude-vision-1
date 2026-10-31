// ALTIMMO-AI-INTEGRATION-01 — API de l'assistant de recherche Altimmo (lecture seule, publique).
//
// POST /api/altimmo/assistant/search   { query, page?, limit?, pageToken? }
// POST /api/altimmo/assistant/compare  { query, count? } | { propertyIds, query? }
//
// Le contrôleur ne parle qu'à la passerelle `assistantGateway` : chaque sortie traverse la garde
// de contrat versionnée (liste blanche fermée, projection publique). Le contexte est toujours
// PUBLIC, quel que soit l'appelant : l'assistant ne s'attribue aucun privilège et n'utilise
// jamais un périmètre staff, tenant ou plateforme. Il ne publie, ne réserve, ne paie, ne contacte
// et n'écrit rien. Le texte de la demande n'est ni journalisé ni conservé.
const logger = require('../utils/logger');
const gateway = require('../services/altimmoAssistant/assistantGateway');
const { parseRealEstateRequest } = require('../services/altimmoAssistant/ruleParser');
const { isAltimmoAssistantEnabled, ALTIMMO_ASSISTANT_DISABLED } = require('../config/altimmoAssistant');

const MAX_QUERY_LENGTH = 500;
const MAX_PROPERTY_IDS = 5; // plafond par défaut de comparisonPolicy (DEFAULT_MAX_LISTINGS)
const PUBLIC_CONTEXT = Object.freeze({ scopeMode: 'PUBLIC' });
const SEARCH_KEYS = new Set(['query', 'page', 'limit', 'pageToken']);
const COMPARE_KEYS = new Set(['query', 'count', 'propertyIds']);

// Rappels constants, hors contrat de l'assistant : ils ne dépendent d'aucune donnée.
const NO_COMMERCIAL_ACTION = Object.freeze({
  code: 'NO_COMMERCIAL_ACTION',
  message: 'L’assistant ne publie, ne réserve, ne paie et ne transmet aucune coordonnée. Pour une visite, une candidature ou une réservation, utilisez la fiche de l’annonce.',
});
const STAY_AVAILABILITY_NOT_VERIFIED = Object.freeze({
  code: 'STAY_AVAILABILITY_NOT_VERIFIED',
  message: 'Les disponibilités aux dates souhaitées ne sont pas vérifiées par l’assistant : elles sont confirmées uniquement lors de la réservation.',
});

const fail = (res, status, code, message) => res.status(status).json({ status: 'fail', code, message });

function readBody(req, allowed) {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : null;
  if (!body || Object.keys(body).some((key) => !allowed.has(key))) return null;
  return body;
}

const validQuery = (value) => typeof value === 'string' && value.trim().length > 0 && value.length <= MAX_QUERY_LENGTH;
const optionalPositiveInteger = (value) => value === undefined || (Number.isInteger(value) && value >= 1 && value <= 1000);

function respond(res, result) {
  if (!result || result.status === 'error') {
    return fail(res, 500, 'ALTIMMO_ASSISTANT_OUTPUT_REJECTED', 'La réponse de l’assistant n’a pas pu être produite.');
  }
  const notices = [NO_COMMERCIAL_ACTION];
  if (result.intent === 'STAY' || result.interpretedCriteria?.transaction === 'STAY') notices.push(STAY_AVAILABILITY_NOT_VERIFIED);
  return res.status(200).json({ status: 'success', data: result, notices });
}

// Chaque route : désactivation d'abord (aucune lecture), puis validation fermée du corps.
const guarded = (handler) => async (req, res) => {
  if (!isAltimmoAssistantEnabled()) return fail(res, 503, ALTIMMO_ASSISTANT_DISABLED.code, ALTIMMO_ASSISTANT_DISABLED.message);
  try {
    return await handler(req, res);
  } catch (error) {
    // Aucun contenu de requête ni message interne : seulement la nature de l'erreur.
    logger.error(`[altimmoAssistant] échec ${error?.name || 'Error'}`);
    return fail(res, 500, 'ALTIMMO_ASSISTANT_UNAVAILABLE', 'L’assistant est momentanément indisponible. La recherche classique reste accessible.');
  }
};

const search = guarded(async (req, res) => {
  const body = readBody(req, SEARCH_KEYS);
  if (!body || !validQuery(body.query) || !optionalPositiveInteger(body.page) || !optionalPositiveInteger(body.limit)
    || (body.pageToken !== undefined && (typeof body.pageToken !== 'string' || body.pageToken.length > 2000))) {
    return fail(res, 400, 'ALTIMMO_ASSISTANT_INVALID_REQUEST', 'Requête invalide.');
  }
  const result = await gateway.searchAndRankRealEstate({
    query: body.query, context: PUBLIC_CONTEXT,
    pagination: { page: body.page, limit: body.limit },
    ...(body.pageToken !== undefined ? { pageToken: body.pageToken } : {}),
  });
  return respond(res, result);
});

const compare = guarded(async (req, res) => {
  const body = readBody(req, COMPARE_KEYS);
  const ids = body?.propertyIds;
  const selected = ids !== undefined;
  if (!body || (selected
    ? !Array.isArray(ids) || ids.length < 2 || ids.length > MAX_PROPERTY_IDS || ids.some((id) => typeof id !== 'string')
      || body.count !== undefined || (body.query !== undefined && !validQuery(body.query))
    : !validQuery(body.query) || !optionalPositiveInteger(body.count))) {
    return fail(res, 400, 'ALTIMMO_ASSISTANT_INVALID_REQUEST', 'Requête invalide.');
  }
  if (!selected) {
    return respond(res, await gateway.searchRankAndCompare({
      query: body.query, context: PUBLIC_CONTEXT, ...(body.count !== undefined ? { comparisonCount: body.count } : {}),
    }));
  }
  // Critères de comparaison : uniquement ceux reconnus par l'analyseur déterministe, jamais fournis bruts.
  const parsed = body.query !== undefined ? parseRealEstateRequest(body.query) : null;
  return respond(res, await gateway.compareRealEstate({
    mode: 'SELECTED_LISTINGS', propertyIds: ids, context: PUBLIC_CONTEXT,
    ...(parsed && parsed.status === 'recognized' ? { criteria: parsed.criteria } : {}),
  }));
});

module.exports = { search, compare, MAX_QUERY_LENGTH, MAX_PROPERTY_IDS };
