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
    contratsActifs: data.kpis?.gestionLocative?.contratsActifs ?? 0,
  };
};
