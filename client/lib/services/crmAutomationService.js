import api from './api';

// CRM-AUTOMATION-1 — pur wrapper HTTP autour de /api/crm-automation/*.
// Aucune décision métier ici : le backend seul décide des règles, du score
// et du cockpit.

export const getAutomationRules = async () => (await api.get('/crm-automation/rules')).data.data.rules;
export const createAutomationRule = async (payload) => (await api.post('/crm-automation/rules', payload)).data.data.rule;
export const updateAutomationRule = async (id, payload) => (await api.patch(`/crm-automation/rules/${id}`, payload)).data.data.rule;
export const setAutomationRuleEnabled = async (id, enabled) => (await api.patch(`/crm-automation/rules/${id}/enabled`, { enabled })).data.data.rule;
export const simulateAutomation = async (payload) => (await api.post('/crm-automation/simulate', payload)).data.data.results;
export const getAutomationRuns = async (params = {}) => (await api.get('/crm-automation/runs', { params })).data.data.runs;
export const getCustomerScore = async (customerId) => (await api.get(`/crm-automation/score/${customerId}`)).data.data.score;
export const getAutomationCockpit = async () => (await api.get('/crm-automation/cockpit')).data.data.cockpit;
