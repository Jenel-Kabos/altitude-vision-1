const anomaly = (code, level, message, field, suggestion, observed, expected) => ({ code, level, message, field, suggestion, observed, expected });
const isPositive = value => Number.isFinite(Number(value)) && Number(value) > 0;

const detectValuationAnomalies = ({ estimation, calculation = null }) => {
  const anomalies = []; const land = estimation.land || {}; const construction = estimation.construction || {};
  if (!isPositive(estimation.surface)) anomalies.push(anomaly('SURFACE_INVALID', 'critical', 'La surface principale est invalide.', 'surface', 'Renseignez une surface positive.', estimation.surface, '> 0'));
  if (isPositive(land.surface) && isPositive(construction.builtSurface) && construction.builtSurface > land.surface && !construction.justification) anomalies.push(anomaly('BUILT_OVER_LAND', 'warning', 'La surface bâtie dépasse le terrain sans justification.', 'construction.builtSurface', 'Vérifiez les niveaux ou documentez la justification.', construction.builtSurface, `≤ ${land.surface}`));
  if (construction.depreciationRate != null && (Number(construction.depreciationRate) < 0 || Number(construction.depreciationRate) > 100)) anomalies.push(anomaly('DEPRECIATION_INVALID', 'critical', 'Le taux de vétusté est invalide.', 'construction.depreciationRate', 'Utilisez une valeur entre 0 et 100.', construction.depreciationRate, '0–100'));
  if (estimation.location?.latitude != null && (Number(estimation.location.latitude) < -90 || Number(estimation.location.latitude) > 90)) anomalies.push(anomaly('LATITUDE_INVALID', 'critical', 'Latitude invalide.', 'location.latitude', 'Utilisez une latitude comprise entre -90 et 90.', estimation.location.latitude, '-90–90'));
  if (estimation.location?.longitude != null && (Number(estimation.location.longitude) < -180 || Number(estimation.location.longitude) > 180)) anomalies.push(anomaly('LONGITUDE_INVALID', 'critical', 'Longitude invalide.', 'location.longitude', 'Utilisez une longitude comprise entre -180 et 180.', estimation.location.longitude, '-180–180'));
  (estimation.comparables || []).forEach((item, index) => { if (item.included !== false && (!isPositive(item.pricePerSqm) || !isPositive(item.landSurface || item.builtSurface))) anomalies.push(anomaly('COMPARABLE_INCOMPLETE', 'warning', 'Comparable inclus sans prix/m² ou surface utilisable.', `comparables.${index}`, 'Complétez ou excluez ce comparable.', item._id, 'prix/m² et surface positifs')); if (item.date && (Date.now() - new Date(item.date).getTime()) > 36 * 2629800000) anomalies.push(anomaly('COMPARABLE_OLD', 'info', 'Comparable ancien de plus de 36 mois.', `comparables.${index}.date`, 'Vérifiez sa pertinence et son poids.', item.date, '≤ 36 mois')); });
  if (!(estimation.documents || []).some(document => document.verified)) anomalies.push(anomaly('DOCUMENTS_UNVERIFIED', 'warning', 'Aucun document n’est vérifié.', 'documents', 'Vérifiez les documents disponibles.', 0, 'au moins un document vérifié'));
  if (calculation?.finalResult?.marketValue) { const { low, recommended, high } = calculation.finalResult.marketValue; if (!(low <= recommended && recommended <= high)) anomalies.push(anomaly('RANGE_INVALID', 'critical', 'La fourchette calculée est incohérente.', 'finalResult.marketValue', 'Recalculez avec des données valides.', { low, recommended, high }, 'basse ≤ recommandée ≤ haute')); }
  return anomalies;
};

const confidenceBreakdown = estimation => {
  const docs = (estimation.documents || []).filter(item => item.verified).length;
  const comparables = (estimation.comparables || []).filter(item => item.included !== false);
  const location = estimation.location || {}; const parts = [
    ['Localisation', location.city && location.neighborhood ? 18 : location.city ? 10 : 0, 20],
    ['Références', Math.min(15, comparables.length * 5), 20],
    ['Documents', Math.min(12, docs * 4), 15],
    ['Comparables', Math.min(16, comparables.reduce((sum, item) => sum + (Number(item.similarity) || 0), 0) / Math.max(1, comparables.length) / 6.25), 20],
    ['Photos', (estimation.photos || []).length ? 5 : 0, 10], ['Cohérence', detectValuationAnomalies({ estimation }).some(item => item.level === 'critical') ? 0 : 10, 10],
  ];
  return { total: Math.round(parts.reduce((sum, [, score]) => sum + score, 0)), details: parts.map(([label, score, max]) => ({ label, score: Math.round(score), max })) };
};
module.exports = { detectValuationAnomalies, confidenceBreakdown };
