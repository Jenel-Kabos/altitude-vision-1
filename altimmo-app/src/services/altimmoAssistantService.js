// ALTIMMO-AI-INTEGRATION-02 — assistant de recherche Altimmo (moteur IA-03, sans état serveur).
// Même contrat que client/lib/services/altimmoAssistantService.js ; réponses mises en forme par
// utils/assistantViewModel.js (fichier identique au web). Aucune conversation n'est conservée.
import api from './api';

const withoutEmpty = (body) => Object.fromEntries(Object.entries(body).filter(([, value]) => (
  value !== undefined && value !== null && value !== '' && !(typeof value === 'object' && !Array.isArray(value) && !Object.keys(value).length)
)));

/** `true` seulement si le serveur confirme l'activation ; toute erreur vaut « indisponible ». */
export const getAssistantStatus = async () => {
  try {
    const response = await api.get('/altimmo/assistant/status');
    return response.data?.data?.enabled === true;
  } catch {
    return false;
  }
};

export const searchWithAssistant = async ({ query, filters, pageToken } = {}) => (
  await api.post('/altimmo/assistant/search', withoutEmpty({ query, filters, pageToken }))
).data;

export const compareWithAssistant = async ({ propertyIds, query } = {}) => (
  await api.post('/altimmo/assistant/compare', withoutEmpty({ propertyIds, query }))
).data;
