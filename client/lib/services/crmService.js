import api from './api';

export const synchronizeCrmCustomers = async () => (await api.post('/crm/sync')).data.data.synchronization;
export const getCrmCustomers = async (params = {}) => (await api.get('/crm/customers', { params })).data.data;
export const getCrmCustomer = async (id) => (await api.get(`/crm/customers/${id}`)).data.data;
export const createCrmOpportunity = async (customerId, payload) => (await api.post(`/crm/customers/${customerId}/opportunities`, payload)).data.data.opportunity;
export const moveCrmOpportunity = async (id, stage, note = '') => (await api.patch(`/crm/opportunities/${id}/stage`, { stage, note })).data.data.opportunity;
export const createCrmActivity = async (customerId, payload) => (await api.post(`/crm/customers/${customerId}/activities`, payload)).data.data.activity;
export const updateCrmActivity = async (id, payload) => (await api.patch(`/crm/activities/${id}`, payload)).data.data.activity;
export const getCrmDashboard = async () => (await api.get('/crm/dashboard')).data.data;
export const getCrmPipeline = async () => (await api.get('/crm/pipeline')).data.data;
export const getCrmActivities = async (params = {}) => (await api.get('/crm/activities', { params })).data.data;
export const searchCrm = async (q) => (await api.get('/crm/search', { params: { q } })).data.data;
export const getCrmDuplicates = async () => (await api.get('/crm/duplicates')).data.data;
export const compareCrmCustomers = async (a, b) => (await api.get(`/crm/duplicates/${a}/${b}`)).data.data;
export const consolidateCrmCustomers = async (payload) => (await api.post('/crm/consolidations', payload)).data.data.consolidation;
export const getCrmConsolidations = async () => (await api.get('/crm/consolidations')).data.data.consolidations;
export const setCrmOpportunityOutcome = async (id, outcome, reason = '') => (await api.patch(`/crm/opportunities/${id}/outcome`, { outcome, reason })).data.data.opportunity;
