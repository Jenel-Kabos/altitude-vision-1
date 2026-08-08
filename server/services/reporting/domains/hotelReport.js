// REPORTING-1 — DomainReport Hôtellerie. Réutilise
// dashboardAnalyticsController.hotels() (chambres/occupation/réservations)
// et finance/hotelFinancialDashboardService (déjà periode-aware) — RevPAR et
// ADR sont les seules valeurs réellement nouvelles de ce module (Gap Phase 1
// §3), calculées avec les formules standard du secteur appliquées à des
// nombres déjà réels (aucune donnée inventée) :
//   RevPAR = revenus encaissés (période) / (chambres × jours de la période)
//   ADR    = RevPAR / taux d'occupation (approximation : le taux d'occupation
//            est un instantané courant, pas une moyenne sur la période — la
//            plateforme ne calcule pas d'historique d'occupation quotidien).
const { hotels } = require('../../../controllers/dashboardAnalyticsController');
const { validateDashboardFilters, getHotelFinancialDashboardSummary } = require('../../finance/hotelFinancialDashboardService');

// `hotelId` (ORGANIZATION-1, Phase 9) : si l'unité organisationnelle
// interrogée est directement rattachée à un hôtel (OrgUnit.linkedEstablishment),
// le détail financier est réellement scopé à cet hôtel (réutilise le filtre
// `hotelId` déjà supporté par hotelFinancialDashboardService). L'occupation
// globale (`hotels()`) ne peut PAS être scopée à un seul hôtel aujourd'hui —
// voir `orgScopeNote` ci-dessous, jamais silencieusement approximé.
async function getHotelReport({ user, dateFrom, dateTo, hotelId } = {}) {
  const filters = validateDashboardFilters({ dateFrom, dateTo, hotelId });
  const [occupancy, finance] = await Promise.all([
    hotels(user),
    getHotelFinancialDashboardSummary({ user, filters }),
  ]);

  // RevPAR/ADR combinent un revenu (potentiellement scopé à un hôtel) avec
  // un nombre de chambres (TOUJOURS global — hotels() ne filtre pas par
  // hôtel) : les mélanger sous scope hotelId donnerait un ratio faux. On les
  // calcule donc UNIQUEMENT en vue non scopée, jamais une approximation
  // silencieuse.
  const revenueMinor = finance.totals.confirmedPaymentsMinor;
  const availableRoomNights = (occupancy.kpis.totalRooms || 0) * filters.spanDays;
  const revPARMinor = !hotelId && availableRoomNights > 0 ? Math.round(revenueMinor / availableRoomNights) : null;
  const occupancyRateFraction = (occupancy.kpis.occupancyRate || 0) / 100;
  const adrMinor = !hotelId && revPARMinor !== null && occupancyRateFraction > 0 ? Math.round(revPARMinor / occupancyRateFraction) : null;

  return {
    domain: 'hotel', periodSupported: true,
    orgScopeSupported: Boolean(hotelId),
    orgScopeNote: hotelId ? "Le détail financier (finance.totals) est scopé à cet hôtel ; l'occupation globale (chambres/réservations) et RevPAR/ADR restent non calculables par hôtel unique — hotels() ne supporte pas de filtre par hôtel, jamais approximé silencieusement (RevPAR/ADR renvoyés à null)." : null,
    period: finance.period,
    ...occupancy,
    finance,
    revPARMinor, adrMinor,
    revPARNote: 'RevPAR = encaissements confirmés de la période / (chambres actuelles × jours) ; ADR = RevPAR / taux d\'occupation courant (approximation documentée, aucun historique quotidien d\'occupation en base).',
  };
}

module.exports = { getHotelReport };
