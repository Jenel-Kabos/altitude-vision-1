import api from './api';

// =======================
// 📬 BOÎTES
// =======================

export const getInbox = async () => {
  const res = await api.get('/mail/inbox');
  return res.data.data.mails;
};

export const getSent = async () => {
  const res = await api.get('/mail/sent');
  return res.data.data.mails;
};

export const getStarred = async () => {
  const res = await api.get('/mail/starred');
  return res.data.data.mails;
};

export const getTrash = async () => {
  const res = await api.get('/mail/trash');
  return res.data.data.mails;
};

export const getDrafts = async () => {
  const res = await api.get('/mail/drafts');
  return res.data.data.mails;
};

// =======================
// ✍️ ACTIONS
// =======================

export const sendMail = async (data) => {
  const res = await api.post('/mail/send', data);
  return res.data.data.mail;
};

export const saveDraft = async (data) => {
  const res = await api.post('/mail/draft', data);
  return res.data.data.draft;
};

export const toggleStar = async (id) => {
  const res = await api.patch(`/mail/${id}/star`);
  return res.data.data.mail;
};

// =======================
// 🗑️ CORBEILLE
// =======================

export const moveToTrash = async (id) => {
  await api.patch(`/mail/${id}/trash`);
};

export const restoreFromTrash = async (id) => {
  await api.patch(`/mail/${id}/restore`);
};

export const deleteForever = async (id) => {
  await api.delete(`/mail/${id}`);
};
