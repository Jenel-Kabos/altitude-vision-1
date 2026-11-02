// ALTIMMO-AI-INTEGRATION-01 (DeepSeek) — activation contrôlée du conseiller conversationnel Altimmo.
//
// Trois verrous serveur, tous requis, vérifiés à chaque requête (jamais déduits de l'interface) :
//   1. interrupteur global      ALTIMMO_ADVISOR_ENABLED=true (toute autre valeur : désactivé) ;
//   2. environnement autorisé   ALTIMMO_ADVISOR_ALLOWED_ENVIRONMENTS (défaut « development,test » :
//                               la production doit être nommée explicitement) ;
//   3. compte autorisé          ALTIMMO_ADVISOR_ALLOWED_USER_IDS : identifiants explicitement désignés par
//                               la Direction. Aucun rôle (Admin, Collaborateur…) ne suffit à lui seul.
// L'arrêt immédiat des appels au fournisseur (ALTIMMO_ADVISOR_LLM_STOP=true, ou l'arrêt d'exécution réservé
// aux administrateurs autorisés) laisse le conseiller répondre avec le moteur Altimmo seul.
// L'assistant de recherche existant (config/altimmoAssistant.js) n'est pas concerné.
const OBJECT_ID = /^[a-f0-9]{24}$/i;
const list = (value) => String(value || '').split(',').map((item) => item.trim()).filter(Boolean);

const advisorEnvironment = (env = process.env) => (env.ALTIMMO_DEPLOY_ENV || env.NODE_ENV || 'development').trim().toLowerCase();
const isAdvisorEnabled = (env = process.env) => env.ALTIMMO_ADVISOR_ENABLED === 'true';
const allowedEnvironments = (env = process.env) => (env.ALTIMMO_ADVISOR_ALLOWED_ENVIRONMENTS === undefined
  ? ['development', 'test'] : list(env.ALTIMMO_ADVISOR_ALLOWED_ENVIRONMENTS).map((item) => item.toLowerCase()));
const allowedUserIds = (env = process.env) => new Set(list(env.ALTIMMO_ADVISOR_ALLOWED_USER_IDS).filter((id) => OBJECT_ID.test(id)).map((id) => id.toLowerCase()));
const isLlmStoppedByConfig = (env = process.env) => env.ALTIMMO_ADVISOR_LLM_STOP === 'true';

const ADVISOR_DENIALS = Object.freeze({
  ADVISOR_DISABLED: { status: 503, message: 'Le conseiller Altimmo n’est pas disponible.' },
  ADVISOR_ENVIRONMENT_NOT_ALLOWED: { status: 503, message: 'Le conseiller Altimmo n’est pas disponible.' },
  ADVISOR_ACCESS_DENIED: { status: 403, message: 'Le conseiller Altimmo est réservé aux comptes de test autorisés.' },
});

/** Décision d'accès pour un utilisateur authentifié. `{ allowed: true }` ou `{ allowed: false, code }`. */
function checkAdvisorAccess(user, env = process.env) {
  if (!isAdvisorEnabled(env)) return { allowed: false, code: 'ADVISOR_DISABLED' };
  if (!allowedEnvironments(env).includes(advisorEnvironment(env))) return { allowed: false, code: 'ADVISOR_ENVIRONMENT_NOT_ALLOWED' };
  const id = user?._id ? String(user._id).toLowerCase() : '';
  if (!id || !allowedUserIds(env).has(id)) return { allowed: false, code: 'ADVISOR_ACCESS_DENIED' };
  return { allowed: true };
}

module.exports = {
  advisorEnvironment, isAdvisorEnabled, allowedEnvironments, allowedUserIds, isLlmStoppedByConfig,
  checkAdvisorAccess, ADVISOR_DENIALS,
};
