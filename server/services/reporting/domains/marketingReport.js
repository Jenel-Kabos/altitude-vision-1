// MARKETING-AUTOMATION-1 (Phase 7) — DomainReport Marketing, nouveau membre
// de ReportingService.DOMAINS (REPORTING-1). Réutilise
// domains/communicationReport.js pour tout ce qu'il calcule déjà
// (projets/services/avis/revenu Altcom réel) — n'agrège lui-même QUE ce qui
// n'existe nulle part ailleurs : les métriques d'envoi (MarketingSend),
// strictement inexistantes avant ce sprint (voir audit Phase 1).
const MarketingSend = require('../../../models/MarketingSend');
const MarketingCampaign = require('../../../models/MarketingCampaign');
const MarketingUnsubscribe = require('../../../models/MarketingUnsubscribe');
const { getCommunicationReport } = require('./communicationReport');

async function getMarketingReport({ crmDashboard, tenantId } = {}) {
  const tenantMatch = tenantId ? { tenant: tenantId } : {};
  const [communication, sendsByStatus, sendsByChannel, campaignsByStatus, unsubscribedCount, campaigns] = await Promise.all([
    tenantId
      ? Promise.resolve({ unavailable: true, reason: 'Sources Communication historiques non attribuables au tenant.' })
      : getCommunicationReport({ crmDashboard }),
    MarketingSend.aggregate([{ $match: tenantMatch }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    MarketingSend.aggregate([{ $match: { ...tenantMatch, status: { $in: ['sent', 'opened', 'clicked'] } } }, { $group: { _id: '$channel', count: { $sum: 1 } } }]),
    MarketingCampaign.aggregate([{ $match: tenantMatch }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    MarketingUnsubscribe.countDocuments(tenantMatch),
    MarketingCampaign.find({ ...tenantMatch, status: 'sent' }).select('name channel stats costMinor sentAt').sort({ sentAt: -1 }).limit(20).lean(),
  ]);

  const statusMap = Object.fromEntries(sendsByStatus.map((r) => [r._id, r.count]));
  const sent = (statusMap.sent || 0) + (statusMap.opened || 0) + (statusMap.clicked || 0);
  const opened = (statusMap.opened || 0) + (statusMap.clicked || 0);
  const clicked = statusMap.clicked || 0;
  const failed = statusMap.failed || 0;

  // ROI (Phase 7) : uniquement calculable si la campagne a un coût déclaré
  // (MarketingCampaign.costMinor) — jamais un revenu attribué inventé.
  // Réutilise le seul revenu réel disponible (communicationReport.revenueMinor,
  // lui-même issu de FinancialDocument.domain:'altcom') comme proxy global,
  // JAMAIS une attribution par campagne (aucun modèle d'attribution n'existe).
  const campaignsWithRoi = campaigns.map((c) => ({
    ...c,
    roi: c.costMinor ? { costMinor: c.costMinor, note: 'ROI par campagne non calculable individuellement : aucun modèle d\'attribution de revenu par campagne. Seul un revenu Altcom global existe (voir communication.revenueMinor).' } : null,
  }));

  return {
    domain: 'marketing', periodSupported: false, orgScopeSupported: false, orgScopeNote: null,
    kpis: {
      campagnesTotal: campaignsByStatus.reduce((n, r) => n + r.count, 0),
      campagnesEnvoyees: campaignsByStatus.find((r) => r._id === 'sent')?.count || 0,
      campagnesBrouillon: campaignsByStatus.find((r) => r._id === 'draft')?.count || 0,
      envois: sent + failed,
      envoisReussis: sent,
      echecs: failed,
      ouvertures: opened,
      tauxOuverture: sent > 0 ? Math.round((opened / sent) * 10000) / 100 : null,
      clics: clicked,
      tauxClic: sent > 0 ? Math.round((clicked / sent) * 10000) / 100 : null,
      desabonnements: unsubscribedCount,
    },
    parCanal: sendsByChannel,
    campagnesRecentes: campaignsWithRoi,
    // Réutilisation directe (pas de recalcul) du domaine Communication déjà
    // construit par REPORTING-1 — projets Altcom, services actifs, avis,
    // revenu réel.
    communication,
  };
}

module.exports = { getMarketingReport };
