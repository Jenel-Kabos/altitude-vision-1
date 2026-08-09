import api from './api';

// MARKETING-AUTOMATION-1 — pur wrapper HTTP autour de /api/marketing/*.
// Aucune décision métier ici : le backend seul décide des segments, du
// rendu des modèles et des règles d'approbation de campagne.

export const listSegments = async () => (await api.get('/marketing/segments')).data.data.segments;
export const previewSegment = async (key, params = {}) => (await api.get(`/marketing/segments/${key}/preview`, { params })).data.data;

export const listTemplates = async () => (await api.get('/marketing/templates')).data.data.templates;
export const getTemplateHistory = async (family) => (await api.get(`/marketing/templates/${family}/history`)).data.data.history;
export const createTemplateVersion = async (payload) => (await api.post('/marketing/templates', payload)).data.data.template;
export const activateTemplate = async (id) => (await api.patch(`/marketing/templates/${id}/activate`)).data.data.template;
export const previewTemplate = async (id, variables = {}) => (await api.post(`/marketing/templates/${id}/preview`, { variables })).data.data;

export const listCampaigns = async () => (await api.get('/marketing/campaigns')).data.data.campaigns;
export const createCampaign = async (payload) => (await api.post('/marketing/campaigns', payload)).data.data.campaign;
export const approveCampaign = async (id) => (await api.patch(`/marketing/campaigns/${id}/approve`)).data.data.campaign;
export const cancelCampaign = async (id, reason) => (await api.patch(`/marketing/campaigns/${id}/cancel`, { reason })).data.data.campaign;
export const sendCampaign = async (id) => (await api.post(`/marketing/campaigns/${id}/send`)).data.data.campaign;

export const listSends = async (params = {}) => (await api.get('/marketing/sends', { params })).data.data.sends;
