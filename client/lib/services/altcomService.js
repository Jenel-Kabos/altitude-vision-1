import api from './api';

export const createAltcomProject = async (projectData) => {
  const response = await api.post('/altcom/projects', projectData);
  return response.data;
};

export const createAltcomQuote = async (quoteData) => {
  const response = await api.post('/altcom/quotes', quoteData);
  return response.data;
};

export const getAllAltcomProjects = async (status = null) => {
  const params = status ? { status } : {};
  const response = await api.get('/altcom/projects', { params });
  return response.data;
};

export const getAltcomProjectById = async (projectId) => {
  const response = await api.get(`/altcom/projects/${projectId}`);
  return response.data;
};

export const updateAltcomProjectStatus = async (projectId, status) => {
  const response = await api.patch(`/altcom/projects/${projectId}/status`, { status });
  return response.data;
};

export const deleteAltcomProject = async (projectId) => {
  const response = await api.delete(`/altcom/projects/${projectId}`);
  return response.data;
};
