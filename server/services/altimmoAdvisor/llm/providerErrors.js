'use strict';
// Erreurs fournisseur typées, avec un message générique : jamais de détail technique ni de clé.
const MESSAGES = {
  key_missing: 'Clé du moteur de langage absente.', disabled: 'Moteur de langage désactivé.', auth_failed: 'Clé du moteur de langage refusée.',
  insufficient_balance: 'Crédit du moteur de langage insuffisant.', invalid_request: 'Requête refusée par le moteur de langage.',
  provider_rate_limited: 'Moteur de langage momentanément saturé.', provider_error: 'Erreur du moteur de langage.', provider_overloaded: 'Moteur de langage surchargé.',
  network: 'Moteur de langage injoignable.', timeout: 'Le moteur de langage a dépassé le délai autorisé.', incomplete: 'Réponse du moteur de langage incomplète.',
  malformed: 'Réponse du moteur de langage illisible.', content_filtered: 'Réponse du moteur de langage filtrée.',
};
const providerError = (code) => Object.assign(new Error(MESSAGES[code] || MESSAGES.provider_error), { code: MESSAGES[code] ? code : 'provider_error' });
const abortError = () => Object.assign(new Error('Génération annulée.'), { name: 'AbortError' });
function errorForStatus(status) {
  if (status === 401) return providerError('auth_failed');
  if (status === 402) return providerError('insufficient_balance');
  if (status === 400 || status === 422) return providerError('invalid_request');
  if (status === 429) return providerError('provider_rate_limited');
  if (status === 503) return providerError('provider_overloaded');
  return providerError('provider_error');
}

module.exports = { providerError, abortError, errorForStatus };
