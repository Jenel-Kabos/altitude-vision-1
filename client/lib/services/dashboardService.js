// client/lib/services/dashboardService.js
import api from "./api";

export const getDashboardStats = async (scope) => {
  if (!scope || scope.mode === 'unresolved') {
    const error = new Error("Contexte d'administration requis.");
    error.code = 'ADMINISTRATION_SCOPE_REQUIRED';
    throw error;
  }
  const platformMode = scope.mode === 'platform';
  const response = platformMode
    ? await api.get('/admin/stats', { platformScoped: true })
    : await api.get('/dashboard/stats');

  const data = response.data?.data || {};
  if (platformMode) {
    return {
      stats: {
        Altimmo: data.totalProperties ?? 0,
        MilaEvents: 0,
        Altcom: 0,
        Users: data.totalUsers ?? 0,
        Owners: data.totalOwners ?? 0,
      },
      kpis: null,
      activity: null,
      performance: null,
      contratsActifs: 0,
      pendingProperties: data.pendingProperties ?? 0,
    };
  }

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
