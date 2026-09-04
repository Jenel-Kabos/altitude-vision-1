import api from './api';

export const getOwnerRentalPayments = async (params = {}) => {
  const data = (await api.get('/rental-management/owner/payments', { params })).data.data;
  return {
    ...data,
    items: (data.items || []).map((item) => ({
      ...item,
      period: item.mois && item.annee ? `${String(item.mois).padStart(2, '0')}/${item.annee}` : '—',
      expected: item.montantTotal ?? item.montant ?? 0,
      paid: item.montantRecu ?? 0,
      remaining: item.restant ?? 0,
      status: item.statut,
    })),
  };
};
