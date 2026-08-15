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
export const setValidatedPlatformTenant = (tenantId) => { _validatedPlatformTenantId = tenantId || null; };
export const clearValidatedPlatformTenant = () => { _validatedPlatformTenantId = null; };
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
    if (_validatedPlatformTenantId) config.headers['X-Platform-Tenant-Id'] = _validatedPlatformTenantId;
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
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
