// ALTIMMO-AI-INTEGRATION-02 — couche de présentation de l'assistant Altimmo (contrat IA-03).
//
// Fichier IDENTIQUE dans client/lib/utils/ et altimmo-app/src/utils/ (test de parité) : le web et
// le mobile affichent exactement les mêmes informations. Cette couche ne fait que mettre en forme
// la réponse du moteur : elle n'invente aucun champ, ne calcule aucun frais ni score, et n'affiche
// une caractéristique que si l'annonce la renseigne. Les prix et honoraires restent ceux de
// l'annonce, avec leur libellé exact.

export const TRANSACTION_LABELS = Object.freeze({ BUY: 'Achat', RENT: 'Location', STAY: 'Séjour' });
export const OFFER_LABELS = Object.freeze({ vente: 'Vente', location: 'Location', hebergement: 'Hébergement' });
export const ACCOMMODATION_LABELS = Object.freeze({
  villa_meublee: 'Villa meublée', maison_meublee: 'Maison meublée', appartement_meuble: 'Appartement meublé',
  studio_meuble: 'Studio meublé', residence_meublee: 'Résidence meublée', bungalow: 'Bungalow', hotel: 'Hôtel',
  residence_hoteliere: 'Résidence hôtelière', chambre_hotes: 'Chambre d’hôtes', autre: 'Hébergement',
});
const HOTEL_TYPES = Object.freeze(['hotel', 'residence_hoteliere', 'chambre_hotes']);
export const AMENITY_LABELS = Object.freeze({
  parking: 'Parking', pool: 'Piscine', garden: 'Jardin', terrace: 'Terrasse', air_conditioning: 'Climatisation',
  wifi: 'Wi-Fi', security: 'Sécurité', generator: 'Groupe électrogène', borehole: 'Forage', furnished: 'Meublé',
  equipped_kitchen: 'Cuisine équipée',
});
export const PROXIMITY_LABELS = Object.freeze({
  market: 'un marché', school: 'une école', health: 'un centre de santé', pharmacy: 'une pharmacie',
  transport: 'un transport', supermarket: 'un supermarché', bank: 'une banque', worship: 'un lieu de culte',
});
const FIELD_LABELS = Object.freeze({
  price: 'Prix', bedrooms: 'Nombre de chambres', bathrooms: 'Salles de bain', surface: 'Surface',
  'location.city': 'Ville', 'location.districts': 'Arrondissement', 'location.neighborhood': 'Quartier',
  proximity: 'Proximité', capacity: 'Capacité d’accueil', 'stay.adults': 'Nombre de voyageurs',
  // Champs des contrôles du moteur (`unknownCriteria[].field`).
  'budget.min': 'Prix (budget minimum)', 'budget.max': 'Prix (budget maximum)', 'budget.currency': 'Devise du prix',
  'bedrooms.min': 'Nombre de chambres', 'bathrooms.min': 'Salles de bain', 'surface.min': 'Surface',
  transaction: 'Type d’opération', propertyTypes: 'Type de bien', accommodationTypes: 'Type d’hébergement',
  'stay.availability': 'Disponibilité aux dates', 'stay.children': 'Nombre d’enfants',
});
const CURRENCY_LABELS = Object.freeze({ XAF: 'FCFA', EUR: '€', USD: '$' });

const isText = (value) => typeof value === 'string' && value.trim().length > 0;
const positive = (value) => typeof value === 'number' && Number.isFinite(value) && value > 0;
const unique = (list) => [...new Set(list.filter(isText))];
const plural = (count, word) => `${count} ${word}${count > 1 ? 's' : ''}`;

/** 250000 → « 250 000 FCFA » (groupement manuel : identique sur Hermes et navigateur). */
export function formatAmount(amount, currency = 'XAF') {
  if (!positive(amount)) return null;
  const digits = String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${digits} ${CURRENCY_LABELS[currency] || currency || 'FCFA'}`;
}

/** Libellé d'un critère vérifié par le moteur (« amenities.required.parking » → « Parking »). */
export function criterionLabel(field) {
  if (!isText(field)) return '';
  if (FIELD_LABELS[field]) return FIELD_LABELS[field];
  const amenity = /^amenities\.(?:required|preferred|excluded)\.(.+)$/.exec(field);
  if (amenity) return AMENITY_LABELS[amenity[1]] || amenity[1];
  return field;
}

/** Critères compris par le moteur, tels qu'il les a interprétés. */
export function describeCriteria(criteria) {
  if (!criteria || typeof criteria !== 'object') return [];
  const chips = [];
  const add = (key, label, verifiable = true) => { if (isText(label)) chips.push({ key, label, verifiable }); };
  add('transaction', TRANSACTION_LABELS[criteria.transaction]);
  const types = [...(criteria.propertyTypes || []), ...(criteria.accommodationTypes || []).map((type) => ACCOMMODATION_LABELS[type] || type)];
  add('types', types.join(' ou '));
  const location = criteria.location || {};
  add('location', [...(location.districts || []), location.city].filter(isText).join(', '));
  add('neighborhood', isText(location.neighborhood) ? `Quartier ${location.neighborhood}` : '');
  const budget = criteria.budget || {};
  const min = formatAmount(budget.min, budget.currency || 'XAF');
  const max = formatAmount(budget.max, budget.currency || 'XAF');
  add('budget', min && max ? `Budget de ${min} à ${max}` : max ? `Budget maximum ${max}` : min ? `Budget minimum ${min}` : '');
  if (positive(criteria.bedrooms?.min)) add('bedrooms', `${plural(criteria.bedrooms.min, 'chambre')} minimum`);
  if (positive(criteria.bathrooms?.min)) add('bathrooms', `${plural(criteria.bathrooms.min, 'salle')} de bain minimum`);
  if (positive(criteria.surface?.min)) add('surface', `${criteria.surface.min} m² minimum`);
  const amenities = criteria.amenities || {};
  (amenities.required || []).forEach((key) => add(`required-${key}`, `Exigé : ${AMENITY_LABELS[key] || key}`));
  (amenities.preferred || []).forEach((key) => add(`preferred-${key}`, `Souhaité : ${AMENITY_LABELS[key] || key}`));
  (amenities.excluded || []).forEach((key) => add(`excluded-${key}`, `Sans : ${AMENITY_LABELS[key] || key}`));
  const proximity = criteria.proximity || {};
  [...(proximity.required || []), ...(proximity.preferred || [])].forEach((item) => {
    // Proximité comprise mais jamais vérifiée sans catalogue de points d'intérêt validé.
    add(`proximity-${item.category}`, `Proche d’${PROXIMITY_LABELS[item.category] || item.category}`, false);
  });
  if (positive(criteria.stay?.adults)) add('adults', plural(criteria.stay.adults, 'adulte'));
  return chips;
}

/** Catégorie d'affichage : annonce classique, logement meublé, hôtel ou autre hébergement. */
export function listingCategory(listing = {}) {
  if (listing.status === 'hebergement') return HOTEL_TYPES.includes(listing.accommodationType) ? 'hotel' : 'lodging';
  return /meubl/i.test(String(listing.type || '')) ? 'furnished' : 'classic';
}

function priceOf(listing) {
  const value = formatAmount(listing.price);
  if (!value) return null;
  const label = listing.status === 'vente' ? 'Prix' : listing.status === 'location' ? 'Loyer indiqué' : 'Prix indiqué sur l’annonce';
  return { label, value };
}

/** Carte d'un bien classé par le moteur (`rankedResults` ou `rankedCandidatesToVerify`). */
export function toListingCard(item, { needsVerification = false } = {}) {
  const listing = item?.listing || {};
  const explanation = item?.explanation || {};
  const lodging = listing.status === 'hebergement';
  const features = [
    positive(listing.bedrooms) && plural(listing.bedrooms, 'chambre'),
    positive(listing.bathrooms) && `${plural(listing.bathrooms, 'salle')} de bain`,
    positive(listing.surface) && `${listing.surface} m²`,
  ].filter(Boolean);
  const honoraires = formatAmount(listing.honoraires);
  return {
    id: String(listing.id || listing._id || ''),
    title: isText(listing.title) ? listing.title : 'Annonce Altimmo',
    typeLabel: lodging ? (ACCOMMODATION_LABELS[listing.accommodationType] || 'Hébergement') : (listing.type || OFFER_LABELS[listing.status] || ''),
    offerLabel: OFFER_LABELS[listing.status] || '',
    category: listingCategory(listing),
    isLodging: lodging,
    hotelId: lodging && listing.hotel ? String(listing.hotel) : null,
    location: [listing.address?.neighborhood, listing.address?.arrondissement, listing.address?.city].filter(isText).join(', '),
    price: priceOf(listing),
    honoraires: honoraires ? { label: 'Honoraires indiqués', value: honoraires } : null,
    features,
    image: Array.isArray(listing.images) && isText(listing.images[0]) ? listing.images[0] : null,
    summary: isText(explanation.summary) ? explanation.summary : '',
    satisfied: unique(explanation.favorable || []),
    unmet: unique(explanation.unfavorable || []),
    toVerify: unique([...(explanation.toVerify || []), ...(item?.unknownCriteria || []).map((check) => criterionLabel(check.field))]),
    tradeoffs: unique(explanation.tradeoffs || []),
    needsVerification,
  };
}

const messagesOf = (list) => (Array.isArray(list) ? list : []).filter((item) => isText(item?.message));
const byCode = (list) => [...new Map(list.map((item) => [item.code, item])).values()];

/** Vue d'une recherche (réponse de POST /assistant/search). */
export function toSearchView(envelope) {
  const data = envelope?.data || {};
  const results = (data.rankedResults || []).map((item) => toListingCard(item));
  const toVerify = (data.rankedCandidatesToVerify || []).map((item) => toListingCard(item, { needsVerification: true }));
  const warnings = byCode([...messagesOf(data.warnings), ...messagesOf(data.rankingWarnings)]);
  let kind = 'invalid';
  if (data.status === 'success') kind = results.length || toVerify.length ? 'results' : 'empty';
  else if (data.status === 'needs_clarification') kind = 'incomplete';
  return {
    kind,
    criteria: describeCriteria(data.interpretedCriteria),
    questions: (data.clarificationQuestions || []).filter(isText),
    results,
    toVerify,
    noExactMatch: warnings.some((item) => item.code === 'NO_EXACT_MATCH'),
    unverifiable: byCode([...messagesOf(data.unverifiableCriteria), ...messagesOf(data.unsupportedCriteria)]).map((item) => item.message),
    warnings: warnings.filter((item) => item.code !== 'NO_EXACT_MATCH').map((item) => item.message),
    orderLabel: data.rankingOrder === 'RELEVANCE' ? 'Classés selon vos préférences' : 'Classés de l’annonce la plus récente à la plus ancienne',
    nextPageToken: isText(data.nextPageToken) ? data.nextPageToken : null,
    notices: messagesOf(envelope?.notices).map((item) => item.message),
  };
}

const COMPARISON_MESSAGES = Object.freeze({
  insufficient: 'Ces biens ne peuvent pas être comparés : trop peu d’informations communes sont disponibles.',
  not_compared: 'La comparaison n’a pas pu être établie à partir de cette recherche.',
  invalid: 'Sélectionnez entre 2 et 5 biens publiés.',
  forbidden: 'La comparaison n’est pas disponible.',
});

/** Vue d'une comparaison (réponse de POST /assistant/compare). */
export function toComparisonView(envelope) {
  const data = envelope?.data || {};
  const items = data.items || [];
  const compared = data.status === 'success' && items.length >= 2;
  return {
    kind: compared ? 'compared' : 'unavailable',
    message: compared ? '' : (COMPARISON_MESSAGES[data.status] || COMPARISON_MESSAGES.invalid),
    columns: items.map((item) => ({
      id: String(item.id),
      title: isText(item.listing?.title) ? item.listing.title : item.label,
      summary: isText(item.summary) ? item.summary : '',
      advantages: unique((item.advantages || []).map((entry) => entry.text)),
      disadvantages: unique((item.disadvantages || []).map((entry) => entry.text)),
      unknowns: unique((item.unknowns || []).map((entry) => entry.text)),
    })),
    rows: (data.grid?.rows || []).map((row) => ({ key: `${row.group}-${row.key}`, label: row.label, values: (row.values || []).map((value) => value.display) })),
    conclusion: isText(data.conclusion?.text) ? data.conclusion.text : '',
    tradeoffSummary: isText(data.tradeoffSummary) ? data.tradeoffSummary : '',
    unavailableCount: (data.unavailable || []).length,
    notices: messagesOf(envelope?.notices).map((item) => item.message),
  };
}

/** Erreur HTTP → état d'interface (désactivé, débit, requête, réseau, indisponible). */
export function classifyAssistantError(error) {
  const response = error?.response;
  if (!response) return { kind: 'network', message: 'Connexion impossible. Vérifiez votre réseau puis réessayez.' };
  const code = response.data?.code;
  if (response.status === 503 && code === 'ALTIMMO_ASSISTANT_DISABLED') return { kind: 'disabled', message: 'L’assistant de recherche n’est pas encore disponible. La recherche d’annonces reste accessible.' };
  if (response.status === 429) return { kind: 'rate_limited', message: 'Trop de recherches en peu de temps. Réessayez dans une minute.' };
  if (response.status === 400) return { kind: 'invalid', message: 'Votre demande n’a pas pu être lue. Vérifiez les critères saisis.' };
  return { kind: 'unavailable', message: 'L’assistant est momentanément indisponible. La recherche d’annonces reste accessible.' };
}
