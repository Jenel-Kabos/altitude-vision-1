import api from './api';

// USER-ARCH-UX-1 — pur wrapper HTTP autour de /api/user-business-profiles/*
// (USER-ARCH-1), même contrat que la version web
// (client/lib/services/userBusinessProfileService.js). Aucune décision
// métier ici.

export const getEffectiveProfiles = async (userId) => {
  const res = await api.get(`/user-business-profiles/${userId}`);
  return res.data.data.profiles;
};
