// REPORTING-1 — DomainReport Événementiel (Mila Events). Gap Phase 1 §5 :
// Event n'a AUCUN champ prix/budget — impossible de calculer un revenu par
// événement sans inventer une donnée. Le seul revenu réel disponible est la
// part 'mila_events' de FinancialDocument (déjà agrégée par
// crmService.getDashboard — réutilisée, jamais recalculée).
const Event = require('../../../models/Event');

async function getEvenementielReport({ crmDashboard } = {}) {
  const now = new Date();
  const [byStatus, upcoming, featured] = await Promise.all([
    Event.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Event.countDocuments({ date: { $gte: now }, status: 'Publié' }),
    Event.countDocuments({ featured: true, status: 'Publié' }),
  ]);
  const revenueEntry = crmDashboard?.commercial?.revenueByPole?.find((r) => r._id === 'mila_events') || null;
  return {
    domain: 'evenementiel', periodSupported: false,
    eventsByStatus: byStatus,
    upcoming, featured,
    revenueMinor: revenueEntry?.revenueMinor ?? 0,
    note: "Aucun champ prix/budget sur Event — le revenu provient exclusivement des documents financiers domain:mila_events déjà émis ; aucune fréquentation/ROI par événement disponible.",
  };
}

module.exports = { getEvenementielReport };
