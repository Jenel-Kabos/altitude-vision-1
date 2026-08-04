// GL-ASSET-UX-1 — Phase 8 : agrégation portefeuille pour le "Dashboard
// Patrimoine". Réutilise EXCLUSIVEMENT les services par-bien déjà construits
// en GL-ASSET-1 (computeValuation, computeAlerts, getMaintenanceLogbook,
// deriveAssetCycle) — aucune logique de calcul dupliquée ici, uniquement de
// l'orchestration/agrégation. Rien n'est stocké : recalculé à chaque appel.
const Property = require('../models/Property');
const { computeValuation } = require('./propertyAssetValuationService');
const { computeAlerts } = require('./propertyAlertsService');
const { getMaintenanceLogbook } = require('./propertyMaintenanceLogbookService');
const { deriveAssetCycle } = require('./propertyAssetLifecycleService');

const CYCLE_LABELS = {
  disponible: 'Disponible', reserve: 'Réservé', en_location: 'En location', preavis: 'Préavis',
  inspection: 'Inspection', travaux: 'Travaux', vendu: 'Vendu', archive: 'Archivé',
};

async function getPortfolioDashboard({ ownerId } = {}) {
  const filter = ownerId ? { owner: ownerId } : {};
  const properties = await Property.find(filter)
    .select('title type price availability assetCycle assetCycleHistory owner createdAt')
    .lean();

  const results = await Promise.all(properties.map(async (property) => {
    const [valuation, alerts, logbook] = await Promise.all([
      computeValuation(property._id),
      computeAlerts(property._id),
      getMaintenanceLogbook(property._id),
    ]);
    return { property, valuation, alerts, logbook };
  }));

  const valeurTotale = results.reduce((sum, r) => sum + (r.valuation?.valeurReference || 0), 0);

  const valeurParType = {};
  results.forEach((r) => {
    const type = r.property.type || 'Autre';
    valeurParType[type] = (valeurParType[type] || 0) + (r.valuation?.valeurReference || 0);
  });

  const rentabilites = results.map((r) => r.valuation?.rentabiliteNette).filter((v) => v !== null && v !== undefined);
  const rentabiliteMoyenne = rentabilites.length ? rentabilites.reduce((sum, v) => sum + v, 0) / rentabilites.length : null;

  const biensVacants = results.filter((r) => deriveAssetCycle(r.property) === 'disponible').length;
  const biensOccupes = results.filter((r) => deriveAssetCycle(r.property) === 'en_location').length;
  const coutEntretienTotal = results.reduce((sum, r) => sum + (r.logbook?.coutTotal || 0), 0);
  const alertesCritiques = results.filter((r) => r.alerts?.level === 'critique').length;
  const alertesAttention = results.filter((r) => r.alerts?.level === 'attention').length;

  const topRentabilite = [...results]
    .filter((r) => r.valuation?.rentabiliteNette !== null && r.valuation?.rentabiliteNette !== undefined)
    .sort((a, b) => b.valuation.rentabiliteNette - a.valuation.rentabiliteNette)
    .slice(0, 5)
    .map((r) => ({ propertyId: String(r.property._id), title: r.property.title, rentabiliteNette: r.valuation.rentabiliteNette }));

  const historiqueRecent = results
    .flatMap((r) => (r.property.assetCycleHistory || []).map((h) => ({
      propertyId: String(r.property._id), title: r.property.title, to: h.to, label: CYCLE_LABELS[h.to] || h.to, at: h.at,
    })))
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 20);

  return {
    totalBiens: results.length,
    valeurTotale, valeurParType, rentabiliteMoyenne,
    biensVacants, biensOccupes,
    coutEntretienTotal,
    alertesCritiques, alertesAttention,
    topRentabilite,
    historiqueRecent,
  };
}

module.exports = { getPortfolioDashboard };
