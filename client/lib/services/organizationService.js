import api from './api';

// ORGANIZATION-1 — pur wrapper HTTP autour de /api/organization/*. Aucune
// décision métier ici.

export const listOrgUnits = async (params = {}) => (await api.get('/organization/units', { params })).data.data.units;
export const getOrgTree = async (id) => (await api.get(`/organization/units/${id}/tree`)).data.data.tree;
export const createOrgUnit = async (payload) => (await api.post('/organization/units', payload)).data.data.orgUnit;
export const archiveOrgUnit = async (id, reason) => (await api.post(`/organization/units/${id}/archive`, { reason })).data.data.orgUnit;

export const grantMembership = async (payload) => (await api.post('/organization/memberships', payload)).data.data.membership;
export const suspendMembership = async (id, reason) => (await api.post(`/organization/memberships/${id}/suspend`, { reason })).data.data.membership;
export const revokeMembership = async (id, reason) => (await api.post(`/organization/memberships/${id}/revoke`, { reason })).data.data.membership;
export const getUserMemberships = async (userId) => (await api.get(`/organization/memberships/user/${userId}`)).data.data.memberships;
