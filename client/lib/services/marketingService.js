import api from './api';
const platformConfig = { platformScoped: true };

// MARKETING-AUTOMATION-1 — pur wrapper HTTP autour de /api/marketing/*.
// Aucune décision métier ici : le backend seul décide des segments, du
// rendu des modèles et des règles d'approbation de campagne.

export const listSegments = async () => (await api.get('/marketing/segments', platformConfig)).data.data.segments;
export const previewSegment = async (key, params = {}) => (await api.get(`/marketing/segments/${key}/preview`, { params, platformScoped: true })).data.data;

export const listTemplates = async () => (await api.get('/marketing/templates', platformConfig)).data.data.templates;
export const getTemplateHistory = async (family) => (await api.get(`/marketing/templates/${family}/history`, platformConfig)).data.data.history;
export const createTemplateVersion = async (payload) => (await api.post('/marketing/templates', payload, platformConfig)).data.data.template;
export const activateTemplate = async (id) => (await api.patch(`/marketing/templates/${id}/activate`, {}, platformConfig)).data.data.template;
export const previewTemplate = async (id, variables = {}) => (await api.post(`/marketing/templates/${id}/preview`, { variables }, platformConfig)).data.data;

export const listCampaigns = async () => (await api.get('/marketing/campaigns', platformConfig)).data.data.campaigns;
export const createCampaign = async (payload) => (await api.post('/marketing/campaigns', payload, platformConfig)).data.data.campaign;
export const approveCampaign = async (id) => (await api.patch(`/marketing/campaigns/${id}/approve`, {}, platformConfig)).data.data.campaign;
export const cancelCampaign = async (id, reason) => (await api.patch(`/marketing/campaigns/${id}/cancel`, { reason }, platformConfig)).data.data.campaign;
export const sendCampaign = async (id) => (await api.post(`/marketing/campaigns/${id}/send`, {}, platformConfig)).data.data.campaign;

export const listSends = async (params = {}) => (await api.get('/marketing/sends', { params, platformScoped: true })).data.data.sends;
