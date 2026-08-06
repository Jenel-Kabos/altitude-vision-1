import api from './api';

export const synchronizeCrmCustomers = async () => (await api.post('/crm/sync')).data.data.synchronization;
export const getCrmCustomers = async (params = {}) => (await api.get('/crm/customers', { params })).data.data;
export const getCrmCustomer = async (id) => (await api.get(`/crm/customers/${id}`)).data.data;
export const createCrmOpportunity = async (customerId, payload) => (await api.post(`/crm/customers/${customerId}/opportunities`, payload)).data.data.opportunity;
export const moveCrmOpportunity = async (id, stage, note = '') => (await api.patch(`/crm/opportunities/${id}/stage`, { stage, note })).data.data.opportunity;
export const createCrmActivity = async (customerId, payload) => (await api.post(`/crm/customers/${customerId}/activities`, payload)).data.data.activity;
export const updateCrmActivity = async (id, payload) => (await api.patch(`/crm/activities/${id}`, payload)).data.data.activity;
