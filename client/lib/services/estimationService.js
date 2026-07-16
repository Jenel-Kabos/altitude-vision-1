import api from './api';

export const getAllEstimations = async () => {
  const res = await api.get('/estimation', { params: { page: 1, limit: 50 } });
  return res.data?.data?.estimations || [];
};

export const updateEstimation = async (id, data) => {
  const res = await api.patch(`/estimation/${id}`, data);
  return res.data?.data?.estimation;
};

export const getEstimation = async (id) => {
  const res = await api.get(`/estimation/${id}`);
  return res.data?.data?.estimation;
};

export const calculateEstimation = async (id, inputs = {}) => {
  const res = await api.post(`/estimation/${id}/calculate`, inputs);
  return res.data?.data;
};

export const validateEstimation = async (id, comment = '') => {
  const res = await api.post(`/estimation/${id}/validate`, { comment });
  return res.data?.data;
};

export const publishEstimation = async (id, comment = '') => {
  const res = await api.post(`/estimation/${id}/publish`, { comment });
  return res.data?.data;
};

export const getMarketReferences = async (params = {}) => (await api.get('/estimation/references', { params })).data?.data?.references || [];
export const createMarketReference = async data => (await api.post('/estimation/references', data)).data?.data?.reference;
export const updateMarketReference = async (id, data) => (await api.patch(`/estimation/references/${id}`, data)).data?.data?.reference;
export const deactivateMarketReference = async id => (await api.post(`/estimation/references/${id}/deactivate`)).data?.data?.reference;
export const getConstructionCosts = async (params = {}) => (await api.get('/estimation/construction-costs', { params })).data?.data?.costs || [];
export const createConstructionCost = async data => (await api.post('/estimation/construction-costs', data)).data?.data?.cost;
export const getCoefficients = async (params = {}) => (await api.get('/estimation/coefficients', { params })).data?.data?.coefficients || [];
export const createCoefficient = async data => (await api.post('/estimation/coefficients', data)).data?.data?.coefficient;
export const scoreComparable = async (id, data) => (await api.post(`/estimation/${id}/comparables/score`, data)).data?.data;
export const adjustExpertValue = async (id, data) => (await api.post(`/estimation/${id}/adjust-value`, data)).data?.data;
export const getExpertAnalysis = async id => (await api.get(`/estimation/${id}/expert-analysis`)).data?.data;
export const searchInternalComparables = async (id, params = {}) => (await api.get(`/estimation/${id}/internal-comparables`, { params })).data?.data;
export const addInternalComparable = async (id, propertyId) => (await api.post(`/estimation/${id}/internal-comparables`, { propertyId })).data?.data;
export const getMarketHistory = async (params = {}) => (await api.get('/estimation/analytics/market-history', { params })).data?.data?.series || [];
export const getLaboratoryStatistics = async (params = {}) => (await api.get('/estimation/analytics/statistics', { params })).data?.data;
export const compareEstimations = async ids => (await api.post('/estimation/compare', { ids })).data?.data?.estimations || [];
export const updateComparable = async (estimationId, comparableId, data) => (await api.patch(`/estimation/${estimationId}/comparables/${comparableId}`, data)).data?.data;
export const deleteComparable = async (estimationId, comparableId) => (await api.delete(`/estimation/${estimationId}/comparables/${comparableId}`)).data?.data;
