const { COMPARABLE_THRESHOLDS } = require('../utils/valuationConstants');
const clamp = value => Math.max(0, Math.min(100, Math.round(value)));
const ageInMonths = date => date ? Math.max(0, (Date.now() - new Date(date).getTime()) / 2629800000) : null;
const scoreEqual = (a, b) => a && b && String(a).toLowerCase() === String(b).toLowerCase() ? 100 : 0;
const scoreSurface = (target, comparable) => { const a = Number(target); const b = Number(comparable); if (!(a > 0 && b > 0)) return null; return clamp(100 - Math.abs(a - b) / a * 100); };
const radians = value => Number(value) * Math.PI / 180;
const directDistanceKm = (from, to) => {
  if (![from?.latitude, from?.longitude, to?.latitude, to?.longitude].every(Number.isFinite)) return null;
  const dLat = radians(to.latitude - from.latitude); const dLon = radians(to.longitude - from.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(dLon / 2) ** 2;
  return Number((6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));
};
const locationScore = (estimation, comparable, distance) => {
  const location = estimation.location || {};
  if (scoreEqual(location.microZone, comparable.microZone)) return 100;
  if (scoreEqual(location.neighborhood, comparable.neighborhood)) return 90;
  if (scoreEqual(location.district, comparable.district)) return 72;
  if (!scoreEqual(location.city, comparable.city)) return 0;
  if (distance == null) return 45;
  if (distance <= COMPARABLE_THRESHOLDS.nearDistanceKm) return 65;
  if (distance <= COMPARABLE_THRESHOLDS.mediumDistanceKm) return 50;
  if (distance <= COMPARABLE_THRESHOLDS.farDistanceKm) return 30;
  return 12;
};

const calculateComparableSimilarity = ({ estimation, comparable }) => {
  const distance = directDistanceKm(estimation.location, comparable);
  const details = {
    location: locationScore(estimation, comparable, distance),
    propertyType: scoreEqual(estimation.typeBien, comparable.propertyType),
    landSurface: scoreSurface(estimation.land?.surface || estimation.surface, comparable.landSurface),
    builtSurface: scoreSurface(estimation.construction?.builtSurface, comparable.builtSurface),
    condition: scoreEqual(estimation.construction?.condition || estimation.etat, comparable.condition),
    recency: ageInMonths(comparable.date) == null ? 35 : clamp(100 - ageInMonths(comparable.date) * 4),
  };
  const values = Object.values(details).filter(value => value !== null);
  const score = values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
  const sourceConfidence = comparable.sourceConfidence === 'élevé' ? 1 : comparable.sourceConfidence === 'bon' ? .85 : comparable.sourceConfidence === 'moyen' ? .7 : .5;
  const recencyFactor = (details.recency || 0) / 100;
  const suggestedWeight = Number(((score / 100) * sourceConfidence * Math.max(.25, recencyFactor)).toFixed(2));
  const warnings = [];
  if (comparable.askingPrice && !comparable.concludedPrice) warnings.push('Prix demandé : il ne doit pas être présenté comme un prix conclu.');
  if (!comparable.date) warnings.push('Date de référence absente : la récence est dégradée.');
  if (distance != null && distance > COMPARABLE_THRESHOLDS.farDistanceKm) warnings.push('Comparable éloigné : son influence est fortement réduite.');
  const strength = value => value >= 80 ? 'fort' : value >= 50 ? 'moyen' : 'faible';
  const explanation = [
    { factor: 'micro-localisation', level: strength(details.location), score: details.location },
    { factor: 'type de bien', level: strength(details.propertyType), score: details.propertyType },
    ...(details.landSurface != null ? [{ factor: 'surface terrain', level: strength(details.landSurface), score: details.landSurface }] : []),
    ...(details.builtSurface != null ? [{ factor: 'surface bâtie', level: strength(details.builtSurface), score: details.builtSurface }] : []),
    { factor: 'récence', level: strength(details.recency), score: details.recency },
    { factor: 'fiabilité de la source', level: comparable.priceType === 'conclu' ? 'fort' : comparable.priceType === 'negocie' ? 'moyen' : 'réduit', score: Math.round(sourceConfidence * 100) },
    ...(distance == null ? [] : [{ factor: 'distance directe', level: distance <= COMPARABLE_THRESHOLDS.nearDistanceKm ? 'fort' : distance <= COMPARABLE_THRESHOLDS.mediumDistanceKm ? 'moyen' : 'faible', value: `${distance} km` }]),
  ];
  return { score, details, distance, suggestedWeight, explanation, warnings };
};
module.exports = { calculateComparableSimilarity, directDistanceKm };
