'use strict';
// ALTIMMO-AI-INTEGRATION-01 (DeepSeek) — outils immobiliers du conseiller, exécutés dans le processus.
//
// Le conseiller ne lit jamais MongoDB lui-même : la recherche et la comparaison passent par la passerelle
// IA-03 (`altimmoAssistant/assistantGateway`, garde de contrat comprise) en contexte PUBLIC, et la liste
// générale par les mêmes portes de visibilité publique (`assistantPublicPropertyGates`) et la même
// projection (`publicListingService.toPublicListing`) que l'API publique. Aucun appel HTTP vers
// l'application elle-même : pas de dépendance circulaire, pas de limiteur IA-03 à contourner.
const Property = require('../../models/Property');
const gateway = require('../altimmoAssistant/assistantGateway');
const { assistantPublicPropertyGates } = require('../altimmoAssistant/publicVisibility');
const publicListing = require('../publicListingService');
const { publicFacts } = require('./publicProjection');
const { CITIES } = require('./conversationState');

const PUBLIC_CONTEXT = Object.freeze({ scopeMode: 'PUBLIC' });
const MAX_LIST = 100;
const ALLOWED_CRITERIA = new Set(['transaction', 'propertyTypes', 'accommodationTypes', 'location', 'budget', 'bedrooms', 'bathrooms', 'surface', 'floors', 'amenities', 'proximity', 'stay']);

// Période du prix : uniquement déduite du statut public de l'offre (jamais devinée à partir du montant).
const PERIOD_BY_STATUS = Object.freeze({ vente: 'sale', location: 'month', hebergement: 'night' });
// Hébergement annoncé publiquement : statut public « hebergement ». Une annonce hôtelière publiée sous
// le type « Commerce » est reconnue par ce seul champ public, sans fusion avec la fiche Hotel.
const isPublicLodging = (listing) => listing?.status === 'hebergement';

function toFacts(record) {
  const facts = publicFacts({ ...record, pricePeriod: record.pricePeriod || PERIOD_BY_STATUS[record.status] || null });
  // Liens publics uniquement : fiche hôtel publiée si l'annonce y est rattachée, première image publique.
  facts.hotelId = record.hotel ? String(record.hotel) : null;
  facts.image = Array.isArray(record.images) ? record.images.find((url) => typeof url === 'string' && /^https:\/\//.test(url)) || null : null;
  facts.lodging = isPublicLodging(record);
  return facts;
}

function validateCriteria(criteria = {}) {
  if (!criteria || typeof criteria !== 'object' || Array.isArray(criteria)) throw new Error('Critères invalides.');
  for (const key of Object.keys(criteria)) if (!ALLOWED_CRITERIA.has(key)) throw new Error(`Critère interdit: ${key}`);
}

const normalizeText = (value) => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Séjour : IA-03 ne lit que les hébergements dotés d'une fiche de séjour publiée. Les annonces publiées en
// statut « hebergement » sans cette fiche sont ajoutées comme candidates à vérifier, filtrées par les seuls
// critères publics comparables (ville, quartier, type, tarif par nuit), jamais comme disponibles.
function lodgingMatches(facts, criteria) {
  const location = criteria?.location || {};
  if (location.city && facts.address.city && normalizeText(facts.address.city) !== normalizeText(location.city)) return false;
  const districts = (location.districts || []).map(normalizeText);
  if (districts.length && facts.address.arrondissement && !districts.includes(normalizeText(facts.address.arrondissement))) return false;
  const types = (criteria?.propertyTypes || []).map(normalizeText);
  const accommodationTypes = (criteria?.accommodationTypes || []).map(normalizeText);
  const hotelWanted = types.includes('hotel') || accommodationTypes.includes('hotel');
  const isHotel = normalizeText(facts.accommodationType) === 'hotel' || Boolean(facts.hotelId) || /\bhotel\b/.test(normalizeText(facts.title));
  if (types.length && !types.includes(normalizeText(facts.type)) && !(hotelWanted && isHotel)) return false;
  if (hotelWanted && !isHotel) return false;
  const max = criteria?.budget?.max;
  if (Number.isFinite(max) && Number.isFinite(facts.price) && facts.price > max) return false;
  return true;
}

const LODGING_EXPLANATION = Object.freeze({ summary: 'Hébergement annoncé publiquement ; disponibilité aux dates souhaitées non vérifiée.' });

function createEngineAdapter({ gatewayImpl = gateway, listProperties = null, now = Date.now, listTtlMs = 30_000 } = {}) {
  const readPublished = listProperties || (async () => {
    const rows = await Property.find(assistantPublicPropertyGates()).sort({ createdAt: -1, _id: 1 }).limit(MAX_LIST).lean();
    return rows.map((row) => publicListing.toPublicListing(row));
  });
  let cached = null;
  async function published() {
    if (cached && now() - cached.at < listTtlMs) return cached.items;
    const items = (await readPublished()).map(toFacts);
    cached = { at: now(), items };
    return items;
  }

  return {
    async listPublished() {
      return { status: 'success', items: (await published()).map((listing) => ({ listing: structuredClone(listing), explanation: {}, unknownCriteria: [] })) };
    },
    async searchPublished({ query, criteria = {} } = {}) {
      validateCriteria(criteria);
      const text = typeof query === 'string' ? query.slice(0, 500) : '';
      const ask = async (q) => {
        const out = await gatewayImpl.searchAndRankRealEstate({ query: q, context: PUBLIC_CONTEXT, pagination: { page: 1, limit: 10 } });
        if (!out || out.status === 'error') throw new Error('Moteur Altimmo indisponible.');
        return out;
      };
      let data = await ask(text);
      // IA-03 (main) exige un lieu. Un client qui n'en cite aucun ne restreint pas le lieu : la même recherche est
      // faite dans chaque ville couverte, puis fusionnée. Aucun autre critère n'est ajouté ni deviné.
      const location = data.interpretedCriteria?.location;
      if (data.status === 'needs_clarification' && location && !location.city && !(location.districts || []).length) {
        const perCity = [];
        for (const city of Object.keys(CITIES)) perCity.push(await ask(`${text}, à ${city}`.slice(0, 500)));
        const usable = perCity.filter((item) => item.status !== 'needs_clarification');
        if (usable.length) {
          data = {
            ...usable[0],
            interpretedCriteria: { ...usable[0].interpretedCriteria, location: { ...usable[0].interpretedCriteria.location, city: null } },
            rankedResults: usable.flatMap((item) => item.rankedResults || []),
            rankedCandidatesToVerify: usable.flatMap((item) => item.rankedCandidatesToVerify || []),
          };
        }
      }
      const map = (item) => ({
        listing: toFacts(item.listing || {}),
        explanation: item.explanation && typeof item.explanation === 'object' ? structuredClone(item.explanation) : {},
        unknownCriteria: Array.isArray(item.unknownCriteria) ? structuredClone(item.unknownCriteria) : [],
      });
      const unique = new Set();
      const items = [...(data.rankedResults || []).map(map), ...(data.rankedCandidatesToVerify || []).map(map)].filter((item) => !unique.has(item.listing.id) && unique.add(item.listing.id));
      const interpreted = data.interpretedCriteria || {};
      if (interpreted.transaction === 'STAY') {
        // Le type validé par le conseiller fait foi pour les hébergements publiés (IA-03 l'a converti pour sa propre recherche).
        const wanted = (criteria.propertyTypes || []).filter((t) => typeof t === 'string');
        const lodgingCriteria = wanted.length ? { ...interpreted, propertyTypes: wanted } : interpreted;
        const seen = new Set(items.map((item) => item.listing.id));
        for (const listing of await published()) {
          if (!listing.lodging || seen.has(listing.id) || !lodgingMatches(listing, lodgingCriteria)) continue;
          items.push({ listing: structuredClone(listing), explanation: { ...LODGING_EXPLANATION }, unknownCriteria: [{ field: 'availability', state: 'UNKNOWN', reason: 'STAY_AVAILABILITY_NOT_VERIFIED' }] });
        }
      }
      return { status: items.length ? 'success' : data.status || 'no_results', criteria: interpreted, items, warnings: data.warnings || [], unverifiable: data.unverifiableCriteria || [] };
    },
    async comparePublished(propertyIds) {
      if (!Array.isArray(propertyIds) || propertyIds.length < 2 || propertyIds.length > 5 || propertyIds.some((id) => typeof id !== 'string' || !id)) throw new Error('La comparaison exige 2 à 5 identifiants valides.');
      const data = await gatewayImpl.compareRealEstate({ mode: 'SELECTED_LISTINGS', propertyIds: [...new Set(propertyIds)], context: PUBLIC_CONTEXT });
      if (!data || data.status === 'error') throw new Error('Comparaison Altimmo indisponible.');
      return {
        status: data.status || 'invalid',
        items: (data.items || []).map((item) => ({ ...item, listing: toFacts(item.listing || {}) })),
        grid: data.grid || { rows: [] }, conclusion: data.conclusion || null,
        unavailable: (data.unavailable || []).map((u) => ({ id: String(u.id || ''), code: String(u.code || '') })),
        envelope: data,
      };
    },
  };
}

// Cache court des recherches identiques d'un même processus (les compromis répètent souvent les mêmes requêtes).
function createCachedTools(tools, { ttlMs = 60_000, max = 200, now = Date.now } = {}) {
  const cache = new Map(); let calls = 0; let hits = 0;
  return {
    async searchPublished(args = {}) {
      const key = String(args.query || '');
      const hit = cache.get(key);
      if (hit && now() - hit.at < ttlMs) { hits += 1; return structuredClone(hit.value); }
      calls += 1;
      const value = await tools.searchPublished(args);
      cache.set(key, { at: now(), value: structuredClone(value) });
      if (cache.size > max) cache.delete(cache.keys().next().value);
      return value;
    },
    async comparePublished(ids, options) { calls += 1; return tools.comparePublished(ids, options); },
    listPublished(options) { calls += 1; return tools.listPublished(options); },
    stats() { return { calls, hits }; },
  };
}

module.exports = { createEngineAdapter, createCachedTools, isPublicLodging, lodgingMatches, PERIOD_BY_STATUS };
