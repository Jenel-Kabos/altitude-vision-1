// client/lib/services/dashboardService.js
import api from "./api";

export const getDashboardStats = async () => {
  const response = await api.get("/dashboard/stats");

  const data = response.data?.data || {};

  return {
    stats:       data.stats       || { Altimmo: 0, MilaEvents: 0, Altcom: 0 },
    kpis:        data.kpis        || null,
    activity:    data.activity    || null,
    performance: data.performance || null,
    // HOTFIX-ADMIN-DASHBOARD-RENTAL-KPI-CONTRACT-1 — `data.kpis.gestionLocative`
    // n'a jamais existé dans la réponse réelle de GET /api/dashboard/stats
    // (data.stats est un objet plat) : le widget affichait donc toujours 0.
    // Le backend fournit désormais `data.stats.RentalActiveContracts`.
    // HOTFIX-ADMIN-DASHBOARD-RENTAL-KPI-CONTRACT-1 — `data.kpis.gestionLocative`
    // n'a jamais existé dans la réponse réelle de GET /api/dashboard/stats
    // (data.stats est un objet plat) : le widget affichait donc toujours 0.
    // Le backend fournit désormais `data.stats.RentalActiveContracts`.
    contratsActifs: data.stats?.RentalActiveContracts ?? 0,
  };
};
