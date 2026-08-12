// REPORTING-1 — DomainReport CRM. Réutilise intégralement crmService et
// crmCockpitService (CRM-AUTOMATION-1) — aucune requête CrmCustomer/
// CrmOpportunity/CrmActivity n'est réécrite ici.
const { getDashboard, getPipeline } = require('../../crmService');
const { getCockpit } = require('../../crmCockpitService');

// `crmDashboard` peut être injecté par l'orchestrateur (voir
// reportingService.js) pour éviter un second appel à la même agrégation
// FinancialDocument/CrmOpportunity ; sinon recalculé pour un usage autonome.
// `scopeUserIds` (ORGANIZATION-1, Phase 9) : Set d'identifiants utilisateurs
// résolus par organizationService.getScopeUserIds — filtre le pipeline déjà
// chargé par `assignedTo`, ne relance JAMAIS l'agrégation CRM sous-jacente.
async function getCrmReport({ crmDashboard, scopeUserIds, tenantId } = {}) {
  const [dashboard, pipeline, cockpit] = await Promise.all([
    crmDashboard ? Promise.resolve(crmDashboard) : getDashboard(new Date(), { tenantId }),
    getPipeline({}, { tenantId }),
    tenantId ? Promise.resolve({ unavailable: true, reason: 'Cockpit global masqué en contexte tenant.' }) : getCockpit(),
  ]);
  const scopedPipeline = scopeUserIds
    ? pipeline.opportunities.filter((o) => o.assignedTo && scopeUserIds.has(String(o.assignedTo._id || o.assignedTo)))
    : pipeline.opportunities;
  return {
    domain: 'crm', periodSupported: false,
    orgScopeSupported: true, // uniquement le pipeline (assignedTo) — voir note
    orgScopeNote: scopeUserIds ? "Filtré sur le pipeline (assignedTo) uniquement ; les KPI globaux (kpis/commercial) et le cockpit restent non filtrés, aucune donnée n'est recalculée." : null,
    kpis: dashboard.kpis,
    commercial: dashboard.commercial,
    pipeline: scopedPipeline,
    stages: pipeline.stages,
    // Automatisations (CRM-AUTOMATION-1) : le cockpit expose déjà les
    // relances/actions prioritaires générées par le moteur — réutilisé tel quel.
    cockpit,
  };
}

module.exports = { getCrmReport };
