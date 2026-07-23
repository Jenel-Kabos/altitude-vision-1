import api from './api';

export const getHotelFinancialDashboardSummary = async (params = {}) => {
  const res = await api.get('/financial/hotel/dashboard/summary', { params });
  return res.data.data;
};
export const getHotelFinancialDashboardTrends = async (params = {}) => {
  const res = await api.get('/financial/hotel/dashboard/trends', { params });
  return res.data.data;
};
export const getHotelFinancialDashboardBreakdown = async (params = {}) => {
  const res = await api.get('/financial/hotel/dashboard/breakdown', { params });
  return res.data.data;
};
export const getHotelFinancialDashboardAging = async (params = {}) => {
  const res = await api.get('/financial/hotel/dashboard/aging', { params });
  return res.data.data;
};
export const getHotelFinancialDashboardAlerts = async (params = {}) => {
  const res = await api.get('/financial/hotel/dashboard/alerts', { params });
  return res.data.data;
};
