const { CURRENCY, CONFIDENCE_THRESHOLDS } = require('../utils/valuationConstants');
const finitePositive = (value, field) => { const n = Number(value); if (!Number.isFinite(n) || n <= 0) throw new Error(`${field} doit être un nombre positif.`); return n; };
const round = value => Math.round(value);
const range = (min, recommended, max) => ({ low: round(min), recommended: round(recommended), high: round(max), currency: CURRENCY });

const calculateLandValue = ({ landSurface, reference, coefficient = 1 }) => {
  const surface = finitePositive(landSurface, 'La surface du terrain');
  if (!reference) throw new Error('Une référence de marché est requise pour le terrain.');
  if (!Number.isFinite(coefficient) || coefficient <= 0) throw new Error('Le coefficient doit être positif.');
  return { method: 'comparative_land', beforeCorrection: range(surface * finitePositive(reference.minPricePerSqm, 'Le prix minimum'), surface * finitePositive(reference.averagePricePerSqm, 'Le prix moyen'), surface * finitePositive(reference.maxPricePerSqm, 'Le prix maximum')), result: range(surface * reference.minPricePerSqm * coefficient, surface * reference.averagePricePerSqm * coefficient, surface * reference.maxPricePerSqm * coefficient) };
};
const calculateReplacementCost = ({ builtSurface, reference, depreciationRate = 0 }) => {
  const surface = finitePositive(builtSurface, 'La surface bâtie'); const depreciation = Number(depreciationRate);
  if (!Number.isFinite(depreciation) || depreciation < 0 || depreciation > 100) throw new Error('Le taux de vétusté doit être compris entre 0 et 100.');
  if (!reference) throw new Error('Une référence de coût de construction est requise.');
  const factor = 1 - depreciation / 100;
  return { method: 'replacement_cost', depreciationRate: depreciation, beforeDepreciation: range(surface * finitePositive(reference.costMinPerSqm, 'Le coût minimum'), surface * finitePositive(reference.costAveragePerSqm, 'Le coût moyen'), surface * finitePositive(reference.costMaxPerSqm, 'Le coût maximum')), result: range(surface * reference.costMinPerSqm * factor, surface * reference.costAveragePerSqm * factor, surface * reference.costMaxPerSqm * factor) };
};
const calculateComparableValue = comparables => {
  const valid = (comparables || []).filter(c => c.included !== false && Number(c.pricePerSqm) > 0 && Number(c.surface || c.landSurface || c.builtSurface) > 0);
  if (!valid.length) return null;
  const weight = valid.reduce((sum, c) => sum + (Number(c.weight) > 0 ? Number(c.weight) : 1), 0);
  const price = valid.reduce((sum, c) => sum + Number(c.pricePerSqm) * (Number(c.weight) > 0 ? Number(c.weight) : 1), 0) / weight;
  const surface = Number(valid[0].targetSurface || valid[0].surface || valid[0].landSurface || valid[0].builtSurface);
  return { method: 'comparables', comparableCount: valid.length, weightedPricePerSqm: round(price), result: range(surface * price * .9, surface * price, surface * price * 1.1) };
};
const calculateIncomeValue = ({ annualNetIncome, capitalizationRate }) => { const income = finitePositive(annualNetIncome, 'Le revenu annuel net'); const rate = finitePositive(capitalizationRate, 'Le taux de capitalisation'); if (rate >= 1) throw new Error('Le taux de capitalisation doit être exprimé entre 0 et 1.'); const value = income / rate; return { method: 'income', capitalizationRate: rate, result: range(value * .9, value, value * 1.1) }; };
const calculateRentalEstimate = ({ monthlyRent, annualCharges = 0, propertyValue }) => { const rent = finitePositive(monthlyRent, 'Le loyer mensuel'); const charges = Number(annualCharges); if (!Number.isFinite(charges) || charges < 0) throw new Error('Les charges annuelles sont invalides.'); const annualGross = rent * 12; const net = annualGross - charges; return { low: round(rent * .9), recommended: round(rent), high: round(rent * 1.1), currency: CURRENCY, annualNetIncome: round(net), grossYield: Number(propertyValue) > 0 ? Number(((annualGross / propertyValue) * 100).toFixed(2)) : null, netYield: Number(propertyValue) > 0 ? Number(((net / propertyValue) * 100).toFixed(2)) : null }; };
const calculateConfidenceScore = ({ location, references = [], documents = [], photos = [], physicalVisit = false, requiredFields = [] }) => { const missing = requiredFields.filter(key => !key); let score = 20; if (location?.city && location?.neighborhood) score += 15; else if (location?.city) score += 8; score += Math.min(25, references.length * 5); score += Math.min(15, documents.filter(d => d?.verified).length * 3); if (photos.length) score += 8; if (physicalVisit) score += 12; score -= Math.min(20, missing.length * 4); score = Math.max(0, Math.min(100, score)); const level = score < CONFIDENCE_THRESHOLDS.low ? 'faible' : score < CONFIDENCE_THRESHOLDS.medium ? 'moyen' : score < CONFIDENCE_THRESHOLDS.good ? 'bon' : 'élevé'; return { score, level, missingData: missing, warnings: missing.length ? ['Des informations manquantes diminuent le niveau de confiance.'] : [] }; };
const calculateFinalRange = methods => { const results = methods.filter(Boolean).map(m => m.result); if (!results.length) throw new Error('Aucune méthode calculable : ajoutez des références ou données suffisantes.'); return range(results.reduce((s, r) => s + r.low, 0) / results.length, results.reduce((s, r) => s + r.recommended, 0) / results.length, results.reduce((s, r) => s + r.high, 0) / results.length); };
module.exports = { calculateLandValue, calculateReplacementCost, calculateComparableValue, calculateIncomeValue, calculateRentalEstimate, calculateConfidenceScore, calculateFinalRange };
