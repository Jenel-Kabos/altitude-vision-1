// MARKETING-CONSENT-1 — Préférences marketing du compte connecté et
// désinscription par lien e-mail (jeton signé, sans authentification).
import api from './api';

export const getMarketingPreferences = async () => (await api.get('/users/me/marketing-preferences')).data.data.preferences;

export const updateMarketingPreferences = async (channels) => (
  await api.patch('/users/me/marketing-preferences', { channels, client: 'web' })
).data.data.preferences;

export const unsubscribeWithToken = async (token) => (await api.post('/marketing-preferences/unsubscribe', { token })).data;
