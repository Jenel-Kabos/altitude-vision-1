import api from './api';

export const sendContactMessage = async (messageData) => {
  const response = await api.post('/contact', messageData);
  return response.data;
};

export const getAllContactMessages = async (params = {}) => {
  const response = await api.get('/contact', { params });
  return response.data;
};

export const getContactMessageById = async (messageId) => {
  const response = await api.get(`/contact/${messageId}`);
  return response.data;
};

export const updateMessageStatus = async (messageId, status, responseNote) => {
  const data = { status };
  if (responseNote) data.responseNote = responseNote;
  const response = await api.patch(`/contact/${messageId}/status`, data);
  return response.data;
};

export const deleteContactMessage = async (messageId) => {
  const response = await api.delete(`/contact/${messageId}`);
  return response.data;
};

export const getContactStats = async () => {
  const response = await api.get('/contact/stats');
  return response.data;
};
