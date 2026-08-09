import api from './api';

// ERP-CORE-1 — pur wrapper HTTP autour de /api/erp/*. Aucune décision
// métier ici : le backend seul décide des alertes, des seuils et des
// signaux de santé.

export const getExecutiveOverview = async (params = {}) => (await api.get('/erp/executive', { params })).data.data.overview;
export const getAlerts = async (params = {}) => (await api.get('/erp/alerts', { params })).data.data.alerts;
export const getDecisionCenter = async (params = {}) => (await api.get('/erp/decisions', { params })).data.data.decisions;
export const getPlatformHealth = async (params = {}) => (await api.get('/erp/health', { params })).data.data.health;
