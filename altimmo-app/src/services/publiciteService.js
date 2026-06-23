import api from './api';

export async function getActivePublicites() {
  const res = await api.get('/publicites/active');
  return res.data?.data?.publicites || res.data?.publicites || [];
}
