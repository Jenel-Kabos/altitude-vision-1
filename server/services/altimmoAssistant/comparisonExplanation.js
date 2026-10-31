// IA-03C2 — Gabarits de texte fermés. Aucun texte libre de l'annonce n'est interprété :
// seuls des faits publics typés (montants, nombres, libellés de catalogue, titre) sont insérés.

const AMENITIES = Object.freeze({
  parking: { label: 'Parking', confirmed: 'Parking confirmé', presence: "d'un parking", negative: 'de parking', short: 'parking', confirmedShort: 'parking confirmé' },
  pool: { label: 'Piscine', confirmed: 'Piscine confirmée', presence: "d'une piscine", negative: 'de piscine', short: 'piscine', confirmedShort: 'piscine confirmée' },
  garden: { label: 'Jardin', confirmed: 'Jardin confirmé', presence: "d'un jardin", negative: 'de jardin', short: 'jardin', confirmedShort: 'jardin confirmé' },
  terrace: { label: 'Terrasse', confirmed: 'Terrasse confirmée', presence: "d'une terrasse", negative: 'de terrasse', short: 'terrasse', confirmedShort: 'terrasse confirmée' },
  air_conditioning: { label: 'Climatisation', confirmed: 'Climatisation confirmée', presence: 'de la climatisation', negative: 'de climatisation', short: 'climatisation', confirmedShort: 'climatisation confirmée' },
  wifi: { label: 'Wi-Fi', confirmed: 'Wi-Fi confirmé', presence: 'du Wi-Fi', negative: 'de Wi-Fi', short: 'Wi-Fi', confirmedShort: 'Wi-Fi confirmé' },
  security: { label: 'Sécurité', confirmed: 'Dispositif de sécurité confirmé', presence: "d'un dispositif de sécurité", negative: 'de dispositif de sécurité', short: 'sécurité', confirmedShort: 'sécurité confirmée' },
  generator: { label: 'Groupe électrogène', confirmed: 'Groupe électrogène confirmé', presence: "d'un groupe électrogène", negative: 'de groupe électrogène', short: 'groupe électrogène', confirmedShort: 'groupe électrogène confirmé' },
  borehole: { label: 'Forage', confirmed: 'Forage confirmé', presence: "d'un forage", negative: 'de forage', short: 'forage', confirmedShort: 'forage confirmé' },
  furnished: { label: 'Meublé', confirmed: 'Ameublement confirmé', presence: "de l'ameublement", negative: "d'ameublement", short: 'ameublement', confirmedShort: 'ameublement confirmé' },
  equipped_kitchen: { label: 'Cuisine équipée', confirmed: 'Cuisine équipée confirmée', presence: "d'une cuisine équipée", negative: 'de cuisine équipée', short: 'cuisine équipée', confirmedShort: 'cuisine équipée confirmée' },
});
const PROXIMITY = Object.freeze({
  market: "d'un marché", school: "d'une école", health: "d'un établissement de santé", pharmacy: "d'une pharmacie",
  transport: 'des transports', supermarket: "d'un supermarché", bank: "d'une banque", worship: "d'un lieu de culte",
});
const OFFER_PROSE = Object.freeze({ vente: 'à la vente', location: 'en location', hebergement: 'en hébergement' });
const WANTED = Object.freeze({ BUY: 'un achat', RENT: 'une location', STAY: 'un hébergement' });
const ACCOMMODATION_LABELS = Object.freeze({
  villa_meublee: 'Villa meublée', maison_meublee: 'Maison meublée', appartement_meuble: 'Appartement meublé', studio_meuble: 'Studio meublé',
  residence_meublee: 'Résidence meublée', bungalow: 'Bungalow', hotel: 'Hôtel', residence_hoteliere: 'Résidence hôtelière',
  chambre_hotes: "Chambre d'hôtes", autre: 'Autre hébergement',
});
const CRITERION_SHORT = Object.freeze({
  transaction: "type d'offre", propertyTypes: 'type de bien', accommodationTypes: "type d'hébergement",
  'location.city': 'ville', 'location.districts': 'arrondissement', 'location.neighborhood': 'quartier',
  'budget.max': 'budget maximum', 'budget.min': 'budget minimum', 'bedrooms.min': 'nombre de chambres',
  'bathrooms.min': 'nombre de salles de bains', 'surface.min': 'surface minimale', 'stay.availability': 'disponibilité aux dates',
  'stay.capacity': "capacité d'accueil", 'stay.rooms': 'chambres disponibles', 'stay.nights': 'durée de séjour',
  price_target: 'prix cible', radius: 'rayon de recherche',
});
const PERIOD_PROSE = Object.freeze({ TOTAL: '', MONTH: ' par mois', NIGHT: ' par nuit' });
const PERIOD_GRID = Object.freeze({ TOTAL: '', MONTH: ' / mois', NIGHT: ' / nuit' });

// Même format que rankingExplanation : séparateur de milliers insécable.
const formatAmount = (amount) => String(Math.round(Number(amount))).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
const formatPrice = (price, style = 'prose') => `${formatAmount(price.amount)} ${price.currency}${(style === 'grid' ? PERIOD_GRID : PERIOD_PROSE)[price.period] || ''}`;
const plural = (count, singular, pluralForm) => `${count} ${count === 1 ? singular : pluralForm}`;
const quote = (label) => `« ${label} »`;
function joinList(parts) {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} et ${parts[parts.length - 1]}`;
}
const result = (code, criterion, state, text, source = null) => ({ code, criterion, state, text, source });

/** « parking+garden|terrace » → « parking et jardin ou terrasse » (libellés du catalogue uniquement). */
function alternativeLabel(key) {
  if (typeof key !== 'string') return null;
  const options = key.split('|').map((option) => option.split('+').map((amenity) => AMENITIES[amenity]?.short));
  return options.length >= 2 && options.every((option) => option.every(Boolean)) ? options.map((option) => option.join(' et ')).join(' ou ') : null;
}

function describeContribution(item = {}) {
  if (item.kind === 'AMENITY_ANY') {
    const label = alternativeLabel(item.key);
    if (!label) return null;
    const criterion = `amenity_any.${item.key}`;
    if (item.state === 'TRUE') return result('PREFERENCE_CONFIRMED', criterion, 'TRUE', `Au moins une de vos options est confirmée (${label}), conformément à votre préférence.`, item.source || null);
    if (item.state === 'FALSE') return result('PREFERENCE_UNMET', criterion, 'FALSE', `Aucune de vos options (${label}) n'est disponible.`, item.source || null);
    return result('PREFERENCE_UNKNOWN', criterion, 'UNKNOWN', `Vos options (${label}) ne sont pas renseignées.`, null);
  }
  if (item.kind === 'AMENITY') {
    const a = AMENITIES[item.key];
    if (!a) return null;
    const criterion = `amenity.${item.key}`;
    if (item.state === 'TRUE') return result('PREFERENCE_CONFIRMED', criterion, 'TRUE', `${a.confirmed}, conformément à votre préférence.`, item.source || null);
    if (item.state === 'FALSE') return result('PREFERENCE_UNMET', criterion, 'FALSE', `Ce bien ne dispose pas ${a.negative}, alors que vous le souhaitez.`, item.source || null);
    return result('PREFERENCE_UNKNOWN', criterion, 'UNKNOWN', `La présence ${a.presence} n'est pas renseignée.`, null);
  }
  if (item.kind === 'PRICE_TARGET') {
    const target = formatPrice({ amount: item.target, currency: item.currency, period: item.period });
    if (item.state === 'TRUE') return result('PREFERENCE_CONFIRMED', 'price_target', 'TRUE', `Prix conforme à votre cible de ${target}.`, item.source || null);
    if (item.state === 'FALSE') return result('PREFERENCE_UNMET', 'price_target', 'FALSE', `Prix différent de votre cible de ${target}.`, item.source || null);
    return result('PREFERENCE_UNKNOWN', 'price_target', 'UNKNOWN', "La correspondance avec votre cible de prix n'est pas vérifiable dans cette unité.", null);
  }
  return null;
}

function byState(state, texts) {
  return state === 'TRUE' ? texts.ok : state === 'FALSE' ? texts.ko : texts.unknown;
}

/**
 * @param {{field:string,state:string,reason?:string}} check
 * @param {object} listing projection de comparaison (faits déjà assainis)
 * @param {{criteria?:object,budgetPrice?:object|null,budgetPeriod?:string|null}} context
 */
function describeCheck(check = {}, listing = {}, context = {}) {
  const { field, state } = check;
  if (typeof field !== 'string' || !['TRUE', 'FALSE', 'UNKNOWN'].includes(state)) return null;
  const criteria = context.criteria || {};
  const code = state === 'TRUE' ? 'CRITERION_MET' : state === 'FALSE' ? 'CRITERION_UNMET' : 'CRITERION_UNKNOWN';
  const make = (text, source = 'public_listing') => (text ? result(code, field, state, text, state === 'UNKNOWN' ? null : source) : null);
  const amenity = /^amenities\.(required|excluded)\.([a-z_]+)$/.exec(field);
  if (amenity) {
    const a = AMENITIES[amenity[2]];
    if (!a) return null;
    if (amenity[1] === 'required') return make(byState(state, { ok: `${a.confirmed}, conformément à votre exigence.`, ko: `Ce bien ne dispose pas ${a.negative}, alors que vous l'exigez.`, unknown: `La présence ${a.presence} n'est pas renseignée.` }), 'public_listing.amenities');
    return make(byState(state, { ok: `Absence ${a.negative} confirmée, conformément à votre demande.`, ko: `Ce bien dispose ${a.presence}, que vous souhaitez éviter.`, unknown: `La présence ${a.presence} n'est pas renseignée.` }), 'public_listing.amenities');
  }
  const address = listing.address || {};
  const count = (value, singular, pluralForm) => plural(value, singular, pluralForm);
  switch (field) {
    case 'transaction':
      return make(byState(state, {
        ok: `Proposé ${OFFER_PROSE[listing.status]}, conformément à votre demande.`,
        ko: `Proposé ${OFFER_PROSE[listing.status] || 'sous une autre forme'}, alors que vous cherchez ${WANTED[criteria.transaction] || 'une autre offre'}.`,
        unknown: "Le type d'offre n'est pas renseigné.",
      }), 'public_listing.status');
    case 'propertyTypes':
      return make(byState(state, { ok: `Type de bien : ${listing.type}, conformément à votre demande.`, ko: `Type de bien : ${listing.type}, différent de votre demande.`, unknown: "Le type de bien n'est pas renseigné." }), 'public_listing.type');
    case 'accommodationTypes': {
      const label = ACCOMMODATION_LABELS[listing.accommodationType] || 'Hébergement';
      return make(byState(state, { ok: `${label}, conformément à votre demande.`, ko: `${label}, différent du type d'hébergement demandé.`, unknown: "Le type d'hébergement n'est pas renseigné." }), 'accommodation.accommodationType');
    }
    case 'location.city':
      return make(byState(state, { ok: `Situé à ${address.city}, conformément à votre demande.`, ko: `Situé à ${address.city}, hors de la ville demandée.`, unknown: "La ville n'est pas renseignée." }), 'public_listing.address.city');
    case 'location.districts':
      return make(byState(state, { ok: `Situé à ${address.arrondissement}, conformément à votre demande.`, ko: `Situé à ${address.arrondissement}, hors des arrondissements demandés.`, unknown: "L'arrondissement n'est pas renseigné." }), 'public_listing.address.arrondissement');
    case 'location.neighborhood':
      return make(byState(state, { ok: `Situé dans le quartier ${address.neighborhood}, conformément à votre demande.`, ko: `Situé dans le quartier ${address.neighborhood}, hors du quartier demandé.`, unknown: "Le quartier n'est pas renseigné." }), 'public_listing.address.neighborhood');
    case 'budget.max':
    case 'budget.min': {
      if (state === 'UNKNOWN') {
        return make(check.reason === 'INCOMPARABLE_PRICE_UNIT' || check.reason === 'INCOMPARABLE_CURRENCY'
          ? "Le prix de ce bien n'est pas exprimé dans l'unité de votre budget : aucune conversion n'est appliquée."
          : "Le prix applicable n'est pas vérifié.");
      }
      const price = context.budgetPrice;
      const bound = criteria.budget?.[field === 'budget.max' ? 'max' : 'min'];
      if (!price || bound === null || bound === undefined) return null;
      const actual = formatPrice(price);
      const limit = formatPrice({ amount: bound, currency: price.currency, period: price.period });
      if (field === 'budget.max') return make(state === 'TRUE' ? `Prix de ${actual}, dans votre budget maximum de ${limit}.` : `Prix de ${actual}, supérieur à votre budget maximum de ${limit}.`, price.source);
      return make(state === 'TRUE' ? `Prix de ${actual}, conforme à votre budget minimum de ${limit}.` : `Prix de ${actual}, inférieur à votre budget minimum de ${limit}.`, price.source);
    }
    case 'bedrooms.min':
      return make(byState(state, {
        ok: `${count(listing.bedrooms, 'chambre', 'chambres')}, conformément à votre minimum de ${criteria.bedrooms?.min}.`,
        ko: `${count(listing.bedrooms, 'chambre', 'chambres')}, en dessous de votre minimum de ${criteria.bedrooms?.min}.`,
        unknown: "Le nombre de chambres n'est pas renseigné.",
      }), 'public_listing.bedrooms');
    case 'bathrooms.min':
      return make(byState(state, {
        ok: `${count(listing.bathrooms, 'salle de bains', 'salles de bains')}, conformément à votre minimum de ${criteria.bathrooms?.min}.`,
        ko: `${count(listing.bathrooms, 'salle de bains', 'salles de bains')}, en dessous de votre minimum de ${criteria.bathrooms?.min}.`,
        unknown: "Le nombre de salles de bains n'est pas renseigné.",
      }), 'public_listing.bathrooms');
    case 'surface.min':
      return make(byState(state, {
        ok: `Surface de ${listing.surface} m², conformément à votre minimum de ${criteria.surface?.min} m².`,
        ko: `Surface de ${listing.surface} m², en dessous de votre minimum de ${criteria.surface?.min} m².`,
        unknown: "La surface n'est pas renseignée.",
      }), 'public_listing.surface');
    case 'stay.availability':
      return make(byState(state, { ok: 'Disponibilité vérifiée aux dates demandées.', ko: 'Indisponible aux dates demandées.', unknown: "La disponibilité aux dates demandées n'est pas vérifiée." }), 'availability_check');
    case 'stay.capacity':
      return make(byState(state, { ok: 'Capacité compatible avec le nombre de voyageurs indiqué.', ko: 'Capacité inférieure au nombre de voyageurs indiqué.', unknown: "La capacité d'accueil n'est pas renseignée." }), 'accommodation.capacity');
    case 'stay.rooms':
      return make(byState(state, { ok: 'Nombre de chambres disponibles suffisant.', ko: 'Nombre de chambres disponibles insuffisant.', unknown: "Le nombre de chambres disponibles n'est pas vérifié." }), 'accommodation.rooms');
    case 'stay.nights':
      return make(byState(state, { ok: 'Durée de séjour compatible avec les conditions publiées.', ko: 'Durée de séjour hors des conditions publiées (minimum ou maximum de nuits).', unknown: "Les durées de séjour acceptées ne sont pas renseignées." }), 'accommodation.stayLimits');
    default:
      return null;
  }
}

function describeUnverifiable(item = {}) {
  if (item.key === 'radius') return result('UNVERIFIABLE', 'radius', 'UNKNOWN', "Le rayon de recherche n'est pas vérifiable : aucune coordonnée de référence gouvernée.");
  const place = PROXIMITY[item.category];
  if (!place) return null;
  return result('UNVERIFIABLE', item.key, 'UNKNOWN', `La proximité ${place} n'est pas vérifiable : aucun catalogue de points d'intérêt validé.`);
}

/** Libellé court d'un critère, pour les compromis et la conclusion. */
function criterionShort(criterion) {
  const alternative = /^amenity_any\.(.+)$/.exec(criterion || '');
  if (alternative) return alternativeLabel(alternative[1]);
  const amenity = /^(?:amenity|amenities\.required)\.([a-z_]+)$/.exec(criterion);
  if (amenity) return AMENITIES[amenity[1]]?.short || null;
  const excluded = /^amenities\.excluded\.([a-z_]+)$/.exec(criterion);
  if (excluded) return AMENITIES[excluded[1]] ? `absence ${AMENITIES[excluded[1]].negative}` : null;
  const proximity = /^proximity\.([a-z]+)$/.exec(criterion);
  if (proximity) return PROXIMITY[proximity[1]] ? `proximité ${PROXIMITY[proximity[1]]}` : null;
  return CRITERION_SHORT[criterion] || null;
}

function distinctionPhrase(item) {
  const amenity = /^(?:amenity|amenities\.required)\.([a-z_]+)$/.exec(item.criterion || '');
  switch (item.code) {
    case 'PRICE_LOWEST': return `prix le plus bas (${formatPrice(item.value)})`;
    case 'PRICE_HIGHEST': return `prix le plus élevé (${formatPrice(item.value)})`;
    case 'PRICE_INTERMEDIATE': return `prix intermédiaire (${formatPrice(item.value)})`;
    case 'SURFACE_LARGEST': return `surface la plus grande (${item.value} m²)`;
    case 'SURFACE_SMALLEST': return `surface la plus petite (${item.value} m²)`;
    case 'PREFERENCE_CONFIRMED':
    case 'CRITERION_MET':
      if (amenity && AMENITIES[amenity[1]]) return AMENITIES[amenity[1]].confirmedShort;
      return criterionShort(item.criterion) ? `${criterionShort(item.criterion)} conforme` : null;
    case 'PREFERENCE_UNMET':
    case 'CRITERION_UNMET':
      if (amenity && AMENITIES[amenity[1]]) return `sans ${AMENITIES[amenity[1]].short} (confirmé)`;
      return criterionShort(item.criterion) ? `${criterionShort(item.criterion)} non conforme` : null;
    case 'PREFERENCE_TO_VERIFY':
    case 'CRITERION_TO_VERIFY':
      return criterionShort(item.criterion) ? `${criterionShort(item.criterion)} à vérifier` : null;
    default: return null;
  }
}

function tradeoffText(label, { strengths, weaknesses, neutral, toVerify }) {
  const head = [...strengths, ...neutral].map(distinctionPhrase).filter(Boolean);
  const tail = [...weaknesses, ...toVerify].map(distinctionPhrase).filter(Boolean);
  if (!head.length && !tail.length) return `${quote(label)} : aucune différence vérifiée avec les autres biens comparés.`;
  return `${quote(label)} : ${head.length ? joinList(head) : 'aucun atout distinctif vérifié'}${tail.length ? `, mais ${joinList(tail)}` : ''}.`;
}

const TRADEOFF_SUMMARY = Object.freeze({
  PRESENT: 'Aucun bien ne cumule tous les atouts vérifiés : chaque option implique un compromis.',
  DOMINANT: "Les différences vérifiées vont dans le même sens : aucun compromis n'a été identifié.",
  NONE: "Les données vérifiées ne permettent pas d'identifier de compromis entre ces biens.",
});

function entrySummary({ hasNeeds, advantages, disadvantages, unknowns }) {
  if (!hasNeeds) return 'Aucun critère exprimé : seules les caractéristiques publiées sont présentées.';
  if (!advantages.length) return 'Aucun avantage vérifiable au regard de vos critères.';
  return `${plural(advantages.length, 'avantage vérifié', 'avantages vérifiés')}, ${plural(disadvantages.length, 'inconvénient vérifié', 'inconvénients vérifiés')}, ${plural(unknowns.length, 'point à vérifier', 'points à vérifier')}.`;
}

const CONCLUSION = Object.freeze({
  INSUFFICIENT_DATA: 'Les informations disponibles ne permettent pas de déterminer de manière fiable laquelle de ces annonces répond le mieux à vos préférences.',
  NO_PREFERENCES: "Aucune préférence explicite n'a été exprimée : la comparaison présente les différences sans désigner de bien préférable.",
  NO_PREFERENCES_SEVERAL_ELIGIBLE: "Plusieurs biens respectent vos critères vérifiables ; sans préférence explicite, aucun n'est désigné.",
  NO_ELIGIBLE: "Aucun des biens comparés ne respecte l'ensemble de vos critères vérifiables.",
  NOT_COMPARABLE: "Ces biens ne partagent aucune caractéristique vérifiée directement comparable : aucune recommandation n'est formulée.",
  PARTIAL: ' Comparaison partielle : certaines dimensions ne sont pas directement comparables.',
  COVERAGE: " Cette comparaison porte sur les biens les mieux classés parmi les candidats évalués, et non sur l'ensemble du catalogue Altimmo.",
});

function conclusionText({ verdict, basis, count, leader, tied = [], confirmed = [], toVerify = [], partial = false, coverageLimited = false }) {
  let text;
  const confirmedLabels = confirmed.map(criterionShort).filter(Boolean);
  const verifyLabels = [...new Set(toVerify.map(criterionShort).filter(Boolean))];
  const pending = verifyLabels.length ? ` Restent à vérifier : ${joinList(verifyLabels)}.` : '';
  if (verdict === 'RECOMMENDED' && basis === 'CONSTRAINTS') {
    text = `Parmi les ${count} biens comparés, seul ${quote(leader.label)} respecte l'ensemble de vos critères vérifiables.${pending}`;
  } else if (verdict === 'RECOMMENDED') {
    text = `Parmi les ${count} biens comparés, ${quote(leader.label)} correspond le mieux aux préférences vérifiables que vous avez exprimées.`
      + `${confirmedLabels.length ? ` Confirmé : ${joinList(confirmedLabels)}.` : ''}${pending}`;
  } else if (verdict === 'CONDITIONAL_LEAD') {
    text = `${quote(leader.label)} obtient le score de correspondance le plus élevé parmi les biens comparés, mais l'écart dépend d'informations qui restent à vérifier. Ce classement n'est pas une recommandation certaine.${pending}`;
  } else if (verdict === 'TIE') {
    text = `Les biens ${joinList(tied.map((item) => quote(item.label)))} obtiennent le même score de correspondance : les informations disponibles ne permettent pas de les départager.`;
  } else if (verdict === 'NO_PREFERENCES' && basis === 'SEVERAL_ELIGIBLE') {
    text = CONCLUSION.NO_PREFERENCES_SEVERAL_ELIGIBLE;
  } else {
    text = CONCLUSION[verdict];
  }
  if (partial && ['RECOMMENDED', 'CONDITIONAL_LEAD', 'TIE'].includes(verdict)) text += CONCLUSION.PARTIAL;
  if (coverageLimited) text += CONCLUSION.COVERAGE;
  return text;
}

module.exports = {
  AMENITIES, ACCOMMODATION_LABELS, formatAmount, formatPrice,
  describeContribution, describeCheck, describeUnverifiable, criterionShort,
  tradeoffText, TRADEOFF_SUMMARY, entrySummary, conclusionText,
};
