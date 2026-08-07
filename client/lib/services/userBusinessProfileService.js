import api from './api';

// USER-ARCH-UX-1 — pur wrapper HTTP autour de /api/user-business-profiles/*
// (USER-ARCH-1). Aucune décision métier ici : le backend seul décide de la
// fusion stocké+dérivé (getEffectiveProfiles) et des règles RBAC.

export const getEffectiveProfiles = async (userId) => {
  const res = await api.get(`/user-business-profiles/${userId}`);
  return res.data.data.profiles;
};

export const getProfileHistory = async (userId) => {
  const res = await api.get(`/user-business-profiles/${userId}/history`);
  return res.data.data;
};

export const grantProfile = async (userId, profileType, metadata) => {
  const res = await api.post(`/user-business-profiles/${userId}`, { profileType, metadata });
  return res.data.data.profile;
};

export const suspendProfile = async (userId, profileType, reason) => {
  const res = await api.post(`/user-business-profiles/${userId}/${profileType}/suspend`, { reason });
  return res.data.data.profile;
};

export const revokeProfile = async (userId, profileType, reason) => {
  const res = await api.post(`/user-business-profiles/${userId}/${profileType}/revoke`, { reason });
  return res.data.data.profile;
};
