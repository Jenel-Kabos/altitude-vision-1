// ALTIMMO-AI-INTEGRATION-01 — activation contrôlée de l'assistant de recherche Altimmo.
//
// Désactivé par défaut : les routes de l'assistant répondent 503 tant que la configuration
// explicite `ALTIMMO_ASSISTANT_ENABLED=true` n'est pas posée, après certification sur données
// réelles et décision de la Direction. Toute autre valeur maintient la désactivation.
//
// L'assistant est déterministe : aucun fournisseur de modèle IA n'est branché, aucune donnée
// n'est transmise à un tiers, aucune conversation n'est conservée.
const isAltimmoAssistantEnabled = () => process.env.ALTIMMO_ASSISTANT_ENABLED === 'true';

const ALTIMMO_ASSISTANT_DISABLED = Object.freeze({
  code: 'ALTIMMO_ASSISTANT_DISABLED',
  message: 'L’assistant de recherche Altimmo n’est pas encore disponible.',
});

module.exports = { isAltimmoAssistantEnabled, ALTIMMO_ASSISTANT_DISABLED };
