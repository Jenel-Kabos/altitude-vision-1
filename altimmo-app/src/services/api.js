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

export const normalizeApiError = (error) => {
  const status = error?.response?.status ?? null;
  const isTimeout = error?.code === 'ECONNABORTED';
  const isNetworkError = !error?.response && !isTimeout;
  const method = error?.config?.method?.toUpperCase();
  const retryable = isNetworkError || isTimeout || (status >= 500 && ['GET', 'HEAD'].includes(method));

  return {
    code: error?.response?.data?.code || error?.code || (isNetworkError ? 'NETWORK_ERROR' : 'API_ERROR'),
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
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await deleteToken();
      await sessionInvalidatedHandler?.();
    }
    const normalized = normalizeApiError(error);
    error.normalized = normalized;
    return Promise.reject(error);
  },
);

export default api;
