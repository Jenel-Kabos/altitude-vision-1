import api from './api';

export const getDashboardAnalytics = async (module) => {
  const response = await api.get(`/dashboard-analytics/${module}`);
  return response.data?.data || { kpis: {} };
};
