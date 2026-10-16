// MARKETING-CONSENT-1 — Préférences de communications marketing du compte
// connecté. L'identité est portée par le jeton : aucun identifiant envoyé.
import api from './api';

export const getMarketingPreferences = async () => (await api.get('/users/me/marketing-preferences')).data.data.preferences;

export const updateMarketingPreferences = async (channels) => (
  await api.patch('/users/me/marketing-preferences', { channels, client: 'mobile' })
).data.data.preferences;
