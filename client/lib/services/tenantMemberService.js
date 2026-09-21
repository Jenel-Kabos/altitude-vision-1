// USER-TENANT-MEMBERSHIP-ARCHITECTURE-1E — API canonique membres tenant.
// Chaque appel est tenant-scoped via l'intercepteur `X-Platform-Tenant-Id`
// injecté par `services/api.js`. Aucune route ici ne touche `/users/*`.
import api from './api';

export const listMembers = async () => {
  const res = await api.get('/members');
  return res.data?.data?.members || [];
};

export const searchGlobalUserByEmail = async (email) => {
  try {
    const res = await api.get('/members/search-user', { params: { email } });
    return { found: true, user: res.data?.data?.user || null };
  } catch (err) {
    if (err?.response?.status === 404) return { found: false, user: null };
    throw err;
  }
};

export const addMember = async ({ email, userId, businessRole }) => {
  const res = await api.post('/members', { email, userId, businessRole });
  return res.data?.data?.member;
};

export const changeMemberRole = async (membershipId, businessRole) => {
  const res = await api.patch(`/members/${membershipId}`, { businessRole });
  return res.data?.data?.member;
};

export const suspendMember = async (membershipId) => {
  const res = await api.post(`/members/${membershipId}/suspend`, {});
  return res.data?.data?.member;
};

export const reactivateMember = async (membershipId) => {
  const res = await api.post(`/members/${membershipId}/reactivate`, {});
  return res.data?.data?.member;
};

export const removeMember = async (membershipId) => {
  const res = await api.delete(`/members/${membershipId}`);
  return res.data?.data?.member;
};
