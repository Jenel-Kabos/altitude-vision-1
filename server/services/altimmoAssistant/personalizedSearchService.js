const { rankRealEstateResults } = require('./rankingService');
const crypto = require('node:crypto');
const { publicPagination } = require('../publicListingService');

function defaultCandidates() {
  // Chargement tardif : les tests unitaires injectent des sources sans initialiser Mongoose.
  return require('./intelligentSearchService');
}

const RANKING_ORDER = Object.freeze({ RELEVANCE: 'RELEVANCE', CHRONOLOGICAL: 'CHRONOLOGICAL', CHRONOLOGICAL_FALLBACK: 'CHRONOLOGICAL_FALLBACK' });

/** Réordonne un groupe selon l'ordre chronologique IA-03B (plus récent d'abord, identifiant en départage). */
function chronological(items, order) {
  return [...items].sort((left, right) => order.get(left.listing.id) - order.get(right.listing.id));
}

const withPositions = (items) => items.map((item, index) => ({ ...item, position: index + 1 }));

// IA-03C4 — jeton de continuation sans secret : { v, q, o, l, f }. Il ne donne accès à rien de plus
// qu'un numéro de page ; l'empreinte f détecte un classement modifié entre deux pages.
const TOKEN_VERSION = 1;
const MAX_TOKEN_LENGTH = 512;
const MAX_TOKEN_OFFSET = 1000;
const MAX_PAGE_LIMIT = 50;
const digest = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
const requestDigest = (input) => digest({ query: String(input.query || '').trim(), scope: input.context?.scopeMode || null, preferences: input.rankingPreferences ?? null });
const prefixDigest = (results, toVerify, offset) => digest([results, toVerify].map((group) => group.slice(0, offset).map((item) => `${item.listing.id}:${item.score}`)));

function decodePageToken(raw) {
  if (typeof raw !== 'string' || !raw || raw.length > MAX_TOKEN_LENGTH || !/^[A-Za-z0-9_-]+$/.test(raw)) return null;
  try {
    const token = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    const valid = token && token.v === TOKEN_VERSION && /^[0-9a-f]{16}$/.test(token.q) && /^[0-9a-f]{16}$/.test(token.f)
      && Number.isSafeInteger(token.l) && token.l >= 1 && token.l <= MAX_PAGE_LIMIT
      && Number.isSafeInteger(token.o) && token.o >= token.l && token.o <= MAX_TOKEN_OFFSET && token.o % token.l === 0;
    return valid ? token : null;
  } catch {
    return null;
  }
}

const encodePageToken = (token) => Buffer.from(JSON.stringify({ v: TOKEN_VERSION, ...token })).toString('base64url');

/**
 * IA-03C3 — classement global avant pagination : IA-03B fournit tous les candidats évalués (contrat
 * interne), IA-03C1 les classe en une seule fois, puis la page demandée est découpée dans ce classement.
 * Aucune route, lecture supplémentaire ni action métier n'est créée ici.
 * @param {{query:string,context?:object,pagination?:object,rankingPreferences?:Array}} input
 * @param {{searchDependencies?:object,config?:{maxCandidates?:number,batchSize?:number},searchRealEstateFromText?:Function}} [dependencies]
 */
async function searchAndRankRealEstateFromText(input = {}, dependencies = {}) {
  // Compatibilité IA-03C1 : une recherche paginée injectée est classée telle quelle (aucune page n'est fusionnée).
  if (dependencies.searchRealEstateFromText) {
    const searchResult = await dependencies.searchRealEstateFromText(input, dependencies.searchDependencies || null);
    return rankRealEstateResults({
      searchResult, preferences: input.rankingPreferences === undefined ? searchResult.preferences : input.rankingPreferences, context: input.context || {},
    });
  }
  const service = defaultCandidates();
  const config = service.resolveCandidateConfig(dependencies.config);
  const candidates = await service.searchRealEstateCandidatesFromText(
    { query: input.query, context: input.context }, dependencies.searchDependencies || null, config,
  );
  // IA-03C4 (option A) : une alternative facultative « parking ou jardin » devient une seule préférence AMENITY_ANY.
  const parsedPreferences = [...candidates.preferences, ...(candidates.preferenceAlternatives || []).map((item) => ({ kind: 'AMENITY_ANY', options: item.options }))];
  const ranked = rankRealEstateResults({
    searchResult: { ...candidates, results: candidates.matches, candidatesToVerify: candidates.candidatesToVerify },
    preferences: input.rankingPreferences === undefined ? parsedPreferences : input.rankingPreferences,
    context: input.context || {}, options: { maxCandidates: config.maxCandidates },
  });
  // Pagination : jeton de continuation prioritaire sur page/limit ; un jeton invalide ou étranger est ignoré et signalé.
  const tokenWarnings = []; const requestKey = requestDigest(input);
  let token = null;
  if (input.pageToken !== undefined) {
    token = decodePageToken(input.pageToken);
    if (!token) tokenWarnings.push({ code: 'INVALID_PAGE_TOKEN', message: 'Le jeton de pagination est invalide : la première page est renvoyée.' });
    else if (token.q !== requestKey) {
      tokenWarnings.push({ code: 'PAGE_TOKEN_MISMATCH', message: 'Le jeton de pagination appartient à une autre demande : la première page est renvoyée.' });
      token = null;
    }
  }
  const requested = publicPagination(token ? { page: token.o / token.l + 1, limit: token.l } : (input.pageToken !== undefined ? { page: 1, limit: input.pagination?.limit } : input.pagination || {}));
  const { page, limit, skip } = requested;
  const pagination = { page, limit, pages: Math.ceil((candidates.total || 0) / limit) };
  if (ranked.rankingStatus !== 'ranked') return { ...ranked, rankingWarnings: [...ranked.rankingWarnings, ...tokenWarnings], pagination, nextPageToken: null };

  let results = ranked.rankedResults; let toVerify = ranked.rankedCandidatesToVerify;
  const rankingWarnings = [...ranked.rankingWarnings, ...tokenWarnings];
  const everything = [...results, ...toVerify];
  let rankingOrder = RANKING_ORDER.RELEVANCE;
  if (!ranked.normalizedPreferences.length) rankingOrder = RANKING_ORDER.CHRONOLOGICAL;
  else if (everything.length && everything.every((item) => item.confidence === 0)) {
    // Aucune préférence vérifiable : l'égalité des scores ne doit pas passer pour une recommandation.
    rankingOrder = RANKING_ORDER.CHRONOLOGICAL_FALLBACK;
    rankingWarnings.push({ code: 'RANKING_NOT_DISCRIMINANT', message: 'Aucune préférence n’est vérifiable : l’ordre chronologique est conservé.' });
  }
  if (rankingOrder !== RANKING_ORDER.RELEVANCE) {
    const order = new Map([...candidates.matches, ...candidates.candidatesToVerify.map((item) => item.listing)].map((listing, index) => [listing.id, index]));
    results = withPositions(chronological(results, order)); toVerify = withPositions(chronological(toVerify, order));
  }
  // Le classement est recalculé à chaque page : un changement des pages déjà vues est signalé, jamais masqué.
  if (token && prefixDigest(results, toVerify, token.o) !== token.f) {
    rankingWarnings.push({ code: 'RANKING_CHANGED', message: 'Le classement a changé depuis la page précédente.' });
  }
  const end = skip + limit;
  const nextPageToken = end < Math.max(results.length, toVerify.length) && end <= MAX_TOKEN_OFFSET
    ? encodePageToken({ q: requestKey, o: end, l: limit, f: prefixDigest(results, toVerify, end) })
    : null;
  const ranks = results.length + toVerify.length;
  return {
    ...ranked, rankingOrder, rankingWarnings, pagination, nextPageToken,
    // Pagination après classement : la page N prolonge le même classement global.
    rankedResults: results.slice(skip, end), rankedCandidatesToVerify: toVerify.slice(skip, end),
    rankingCoverage: {
      ...ranked.rankingCoverage, ranked: ranks, limit: config.maxCandidates,
      complete: candidates.coverage.complete === true && ranked.rankingCoverage.complete,
    },
  };
}

module.exports = { searchAndRankRealEstateFromText, RANKING_ORDER };
