// client/lib/services/dashboardService.js
import api from "./api";

const getToken = () => localStorage.getItem("token");

export const getDashboardStats = async () => {
  const token = getToken();
  if (!token) throw new Error("Token manquant, utilisateur non connecté");

  const response = await api.get("/dashboard/stats", {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = response.data?.data || {};

  return {
    // Rétrocompatibilité
    stats:       data.stats       || { Altimmo: 0, MilaEvents: 0, Altcom: 0 },
    // Nouveau
    kpis:        data.kpis        || null,
    activity:    data.activity    || null,
    performance: data.performance || null,
  };
};
