import api from './api';

export const getDashboardAnalytics = async (module, params = {}) => {
  const response = await api.get(`/dashboard-analytics/${module}`, { params });
  return response.data?.data || { kpis: {} };
};
