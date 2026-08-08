// REPORTING-1 — DomainReport Communication (Altcom). Gap Phase 1 §4 : aucune
// agrégation Altcom standalone n'existait avant ce sprint (seuls des
// comptages bruts dans dashboardController.js). AltcomProject.budget est une
// TRANCHE (string enum, ex. '1M-3M'), jamais un montant numérique — donc
// JAMAIS sommé en "chiffre d'affaires" ici (ce serait inventer une donnée).
// Le seul revenu réel disponible est la part 'altcom' de
// FinancialDocument (déjà agrégée par crmService.getDashboard —
// réutilisée, jamais recalculée).
const AltcomProject = require('../../../models/AltcomProject');
const PortfolioItem = require('../../../models/portfolioItemModel');
const Review = require('../../../models/Review');

async function getCommunicationReport({ crmDashboard } = {}) {
  const [byStatus, byBudgetBracket, servicesActifs, avisRecus] = await Promise.all([
    AltcomProject.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    AltcomProject.aggregate([{ $group: { _id: '$budget', count: { $sum: 1 } } }]),
    PortfolioItem.countDocuments({ isPublished: true }),
    Review.countDocuments(),
  ]);
  const revenueEntry = crmDashboard?.commercial?.revenueByPole?.find((r) => r._id === 'altcom') || null;
  return {
    domain: 'communication', periodSupported: false,
    projectsByStatus: byStatus,
    projectsByBudgetBracket: byBudgetBracket,
    servicesActifs,
    avisRecus,
    revenueMinor: revenueEntry?.revenueMinor ?? 0,
    note: 'Aucun montant numérique de projet en base (budget = tranche déclarative) — le revenu provient exclusivement des documents financiers domain:altcom déjà émis.',
  };
}

module.exports = { getCommunicationReport };
