// client/lib/services/actionLogService.js
import api from './api';

export const getActionLogs = async (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') query.set(k, v); });
  const res = await api.get(`/action-logs?${query.toString()}`);
  return res.data;
};

export const getActionLogStats = async (days = 30) => {
  const res = await api.get(`/action-logs/stats?days=${days}`);
  return res.data?.data || {};
};

export const getRecentActionLogs = async (limit = 10) => {
  const res = await api.get(`/action-logs/recent?limit=${limit}`);
  return res.data?.data?.logs || [];
};

export const exportActionLogsCsv = async (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') query.set(k, v); });
  const res = await api.get(`/action-logs/export?${query.toString()}`, { responseType: 'blob' });
  const url  = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement('a');
  link.href  = url;
  link.setAttribute('download', `historique_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
