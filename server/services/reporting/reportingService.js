// REPORTING-1 — ReportingService : point d'entrée unique du Centre de
// Pilotage. Orchestre les 9 DomainReport (un par pôle métier), chacun un
// pur agrégateur de services déjà existants (voir server/services/reporting/
// domains/*.js) — ReportingService lui-même ne contient AUCUNE requête
// Mongo directe sur une collection métier.
//
//   Événement/donnée métier (déjà calculée par un domaine existant)
//           │
//           ▼
//   DomainReport (immobilier / location / patrimoine / accommodation /
//                 hotel / crm / finance / communication / evenementiel)
//           │
//           ▼
//   ReportingService.getExecutiveReport()  ──►  Widgets (client, recharts)
//           │
//           ▼
//   Dashboard Direction / Dashboard <pôle>
//
// Résilience : un domaine qui échoue (erreur réseau, permission manquante)
// n'empêche jamais le reste du rapport de se construire — chaque DomainReport
// est isolé via Promise.allSettled et remonte son statut explicitement.
//
// ORGANIZATION-1 (Phase 9) — `orgUnitId` optionnel : filtre le Reporting par
// Organisation/Filiale/Établissement/Département/Équipe SANS jamais
// recalculer un KPI — uniquement en réutilisant `organizationService.
// getScopeUserIds` (déjà agrégé, aucune boucle) puis, quand un domaine le
// permet réellement (voir `orgScopeSupported` par domaine), soit un
// paramètre de filtre déjà supporté par le service sous-jacent (hotelId côté
// finance hôtelière), soit un post-filtrage en mémoire sur des données déjà
// chargées (pipeline CRM par assignedTo). Les domaines qui ne peuvent pas
// être filtrés honnêtement renvoient `orgScopeSupported:false`, jamais une
// approximation silencieuse.
const { getImmobilierReport } = require('./domains/immobilierReport');
const { getLocationReport } = require('./domains/locationReport');
const { getPatrimoineReport } = require('./domains/patrimoineReport');
const { getAccommodationReport } = require('./domains/accommodationReport');
const { getHotelReport } = require('./domains/hotelReport');
const { getCrmReport } = require('./domains/crmReport');
const { getFinanceReport } = require('./domains/financeReport');
const { getCommunicationReport } = require('./domains/communicationReport');
const { getEvenementielReport } = require('./domains/evenementielReport');
// Référence au module (pas de destructuration) : permet à jest.spyOn(crmService,
// 'getDashboard') d'intercepter réellement l'appel dans les tests de résilience.
const crmService = require('../crmService');
const { getUserKpiSummary } = require('../userKpiService');
const organizationService = require('../organizationService');
const OrgUnit = require('../../models/OrgUnit');

const DOMAINS = ['immobilier', 'location', 'patrimoine', 'accommodation', 'hotel', 'crm', 'finance', 'communication', 'evenementiel'];
const NO_ORG_SCOPE = { orgScopeSupported: false, orgScopeNote: null };

async function settle(promise) {
  const result = await Promise.allSettled([promise]);
  const [outcome] = result;
  return outcome.status === 'fulfilled' ? { status: 'ok', data: outcome.value } : { status: 'error', error: outcome.reason?.message || 'Erreur inconnue' };
}

// Résout `orgUnitId` en (a) l'ensemble des utilisateurs membres (pour le
// post-filtrage CRM) et (b) un éventuel hôtel lié (pour le filtre hôtel déjà
// supporté nativement) — jamais bloquant : une résolution en échec dégrade
// silencieusement vers "aucun scope", jamais une erreur globale.
async function resolveOrgScope(orgUnitId) {
  if (!orgUnitId) return { scopeUserIds: null, hotelId: null };
  try {
    const [scopeUserIds, unit] = await Promise.all([
      organizationService.getScopeUserIds(orgUnitId),
      OrgUnit.findById(orgUnitId).select('linkedEstablishment').lean(),
    ]);
    const hotelId = unit?.linkedEstablishment?.establishmentType === 'Hotel' ? String(unit.linkedEstablishment.establishmentId) : null;
    return { scopeUserIds, hotelId };
  } catch {
    return { scopeUserIds: null, hotelId: null };
  }
}

function withNoOrgScope(dataPromise) {
  return dataPromise.then((data) => ({ ...NO_ORG_SCOPE, ...data }));
}

// `user` : req.user, requis par le DomainReport Hôtel (scope financier) et
// transmis à hotels(). `dateFrom`/`dateTo` : uniquement honorés par les
// domaines dont periodSupported === true (Patrimoine, Hôtel) — voir audit
// Phase 1 ; les autres renvoient un instantané total, jamais silencieusement
// filtré. `orgUnitId` : voir résumé ORGANIZATION-1 ci-dessus.
async function getExecutiveReport({ user, dateFrom, dateTo, orgUnitId } = {}) {
  // Calculée une seule fois puis injectée dans crm/finance/communication/
  // evenementiel — évite de relancer 4 fois la même agrégation
  // FinancialDocument.aggregate (voir Phase 8 performance). En cas d'échec,
  // ne bloque jamais les AUTRES domaines (immobilier/location/patrimoine/
  // accommodation/hotel/users) : chaque domaine dépendant retentera son
  // propre appel (voir crmReport.js/financeReport.js/…) et échouera de façon
  // isolée via settle() ci-dessous, jamais en cascade.
  const [crmDashboard, { scopeUserIds, hotelId }] = await Promise.all([
    crmService.getDashboard().catch(() => null),
    resolveOrgScope(orgUnitId),
  ]);

  const [immobilier, location, patrimoine, accommodation, hotel, crm, finance, communication, evenementiel, users] = await Promise.all([
    settle(withNoOrgScope(getImmobilierReport())),
    settle(withNoOrgScope(getLocationReport())),
    settle(withNoOrgScope(getPatrimoineReport({ dateFrom, dateTo }))),
    settle(withNoOrgScope(getAccommodationReport())),
    settle(getHotelReport({ user, dateFrom, dateTo, hotelId })),
    settle(getCrmReport({ crmDashboard, scopeUserIds })),
    settle(withNoOrgScope(getFinanceReport({ crmDashboard }))),
    settle(withNoOrgScope(getCommunicationReport({ crmDashboard }))),
    settle(withNoOrgScope(getEvenementielReport({ crmDashboard }))),
    settle(getUserKpiSummary()),
  ]);

  return {
    generatedAt: new Date(),
    period: { dateFrom: dateFrom || null, dateTo: dateTo || null },
    orgUnitId: orgUnitId || null,
    domains: { immobilier, location, patrimoine, accommodation, hotel, crm, finance, communication, evenementiel },
    users,
  };
}

async function getDomainReport(domain, { user, dateFrom, dateTo, orgUnitId } = {}) {
  const crmDashboard = ['finance', 'communication', 'evenementiel'].includes(domain) ? await crmService.getDashboard() : null;
  const { scopeUserIds, hotelId } = await resolveOrgScope(orgUnitId);
  switch (domain) {
    case 'immobilier': return withNoOrgScope(getImmobilierReport());
    case 'location': return withNoOrgScope(getLocationReport());
    case 'patrimoine': return withNoOrgScope(getPatrimoineReport({ dateFrom, dateTo }));
    case 'accommodation': return withNoOrgScope(getAccommodationReport());
    case 'hotel': return getHotelReport({ user, dateFrom, dateTo, hotelId });
    case 'crm': return getCrmReport({ scopeUserIds });
    case 'finance': return withNoOrgScope(getFinanceReport({ crmDashboard }));
    case 'communication': return withNoOrgScope(getCommunicationReport({ crmDashboard }));
    case 'evenementiel': return withNoOrgScope(getEvenementielReport({ crmDashboard }));
    default: { const err = new Error(`Domaine de reporting inconnu : ${domain}.`); err.statusCode = 404; throw err; }
  }
}

module.exports = { getExecutiveReport, getDomainReport, DOMAINS };
