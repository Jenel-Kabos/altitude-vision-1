import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { environment } from '../config/environment';

const TOKEN_KEY = 'auth_token';
let sessionInvalidatedHandler = null;

export const saveToken  = (t) => SecureStore.setItemAsync(TOKEN_KEY, t);
export const getToken   = ()  => SecureStore.getItemAsync(TOKEN_KEY);
export const deleteToken = () => SecureStore.deleteItemAsync(TOKEN_KEY);
export const setSessionInvalidatedHandler = (handler) => {
  sessionInvalidatedHandler = typeof handler === 'function' ? handler : null;
};

// SYNC-2A — même convention que `client/lib/services/api.js` : un tenant
// n'est injecté dans l'en-tête `X-Platform-Tenant-Id` QUE s'il a déjà été
// validé contre la liste des tenants réellement autorisés pour l'utilisateur
// courant (voir PlatformTenantRuntimeContext.jsx). Jamais une valeur brute
// lue directement d'un stockage persistant.
let _validatedPlatformTenantId = null;

// TENANT-SWITCH-HARDENING P2-1 (2026-09-25) — Late-response protection.
// Chaque changement effectif du tenant validé incrémente une génération
// (`_tenantEpoch`). L'intercepteur de requête colle un snapshot de cette
// génération sur le config, et l'intercepteur de réponse rejette toute
// réponse dont la génération diverge de la valeur courante. Une réponse
// obtenue sous Tenant A ne peut donc plus repeupler l'interface après un
// switch vers Tenant B — indépendamment de tout refetch au niveau écran.
// Backend inchangé : c'est un renforcement client uniquement.
let _tenantEpoch = 0;
export const getTenantEpoch = () => _tenantEpoch;

export const setValidatedPlatformTenant = (tenantId) => {
  const next = tenantId || null;
  if (_validatedPlatformTenantId !== next) {
    _validatedPlatformTenantId = next;
    _tenantEpoch += 1;
  }
};
export const clearValidatedPlatformTenant = () => {
  if (_validatedPlatformTenantId !== null) {
    _validatedPlatformTenantId = null;
    _tenantEpoch += 1;
  }
};
export const getValidatedPlatformTenant = () => _validatedPlatformTenantId;

// SYNC-2A — codes structurés distinguant un compte devenu inutilisable
// (session à invalider) d'un 403 d'autorisation ordinaire (ownership/
// capability, jamais un logout). Voir authMiddleware.js/authController.js.
const ACCOUNT_DISABLED_CODES = new Set(['ACCOUNT_SUSPENDED', 'ACCOUNT_BANNED', 'ACCOUNT_INACTIVE']);
export const isAccountDisabledError = (error) => ACCOUNT_DISABLED_CODES.has(error?.response?.data?.code);

export const normalizeApiError = (error) => {
  const status = error?.response?.status ?? null;
  const isTimeout = error?.code === 'ECONNABORTED';
  const isNetworkError = !error?.response && !isTimeout;
  const method = error?.config?.method?.toUpperCase();
  const retryable = isNetworkError || isTimeout || (status >= 500 && ['GET', 'HEAD'].includes(method));

  return {
    code: error?.response?.data?.code || error?.code || (isNetworkError ? 'NETWORK_ERROR' : 'API_ERROR'),
    // Message serveur déjà destiné à l'utilisateur (ex. compte suspendu) —
    // conservé tel quel plutôt qu'écrasé par le message générique ci-dessous
    // lorsque le backend en fournit un.
    serverMessage: error?.response?.data?.message || null,
    status,
    message: isTimeout
      ? 'La requête a expiré.'
      : isNetworkError
        ? 'Connexion réseau indisponible.'
        : 'Une erreur est survenue. Veuillez réessayer.',
    isNetworkError,
    isTimeout,
    retryable,
  };
};

const api = axios.create({
  baseURL: environment.apiUrl,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(
  async (config) => {
    const token = await getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    if (_validatedPlatformTenantId) {
      config.headers['X-Platform-Tenant-Id'] = _validatedPlatformTenantId;
      // Snapshot pour la détection stale-response — voir P2-1.
      config.__tenantAtSend = _validatedPlatformTenantId;
      config.__tenantEpochAtSend = _tenantEpoch;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => {
    // TENANT-SWITCH-HARDENING P2-1 — Si la génération tenant a changé entre
    // le départ et l'arrivée de la réponse, la réponse est considérée
    // périmée (« stale ») : elle ne doit jamais être livrée à l'écran
    // courant, qui affiche désormais le contexte d'un autre tenant.
    const cfg = response?.config;
    if (cfg && cfg.__tenantEpochAtSend !== undefined && cfg.__tenantEpochAtSend !== _tenantEpoch) {
      const staleError = new Error('Réponse liée à un contexte tenant révolu.');
      staleError.code = 'STALE_TENANT_RESPONSE';
      staleError.isStaleTenant = true;
      staleError.normalized = {
        code: 'STALE_TENANT_RESPONSE',
        status: response.status ?? null,
        message: 'Le contexte tenant a changé pendant la requête.',
        serverMessage: null,
        isNetworkError: false,
        isTimeout: false,
        retryable: false,
      };
      return Promise.reject(staleError);
    }
    return response;
  },
  async (error) => {
    // 401 : session/authentification invalide (token expiré/invalide,
    // tokenVersion révoqué, mot de passe changé) — toujours un nettoyage
    // central. 403 « compte suspendu/banni/inactif » (voir
    // isAccountDisabledError) déclenche le MÊME nettoyage car l'utilisateur
    // authentifié n'a plus de session utilisable, mais un 403 ordinaire
    // (ownership/capability) ne doit JAMAIS provoquer de déconnexion —
    // distinction faite sur le `code` structuré, jamais sur le seul statut.
    if (error.response?.status === 401 || isAccountDisabledError(error)) {
      await deleteToken();
      clearValidatedPlatformTenant();
      await sessionInvalidatedHandler?.(error.response?.data?.message || null);
    }
    const normalized = normalizeApiError(error);
    error.normalized = normalized;
    return Promise.reject(error);
  },
);

export default api;
