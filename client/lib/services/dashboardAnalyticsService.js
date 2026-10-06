import api from './api';

export const getDashboardAnalytics = async (module, params = {}, { platformScoped = false } = {}) => {
  const response = await api.get(`/dashboard-analytics/${module}`, { params, ...(platformScoped ? { platformScoped: true } : {}) });
  return response.data?.data || { kpis: {} };
};
