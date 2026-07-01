import api from './api';

export const getMyTransactions = async () => {
  const res = await api.get('/transactions/my');
  return res.data?.data?.transactions || [];
};
