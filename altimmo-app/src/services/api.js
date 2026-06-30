import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL = 'https://altitude-vision.onrender.com/api';

const TOKEN_KEY = 'auth_token';

export const saveToken  = (t) => SecureStore.setItemAsync(TOKEN_KEY, t);
export const getToken   = ()  => SecureStore.getItemAsync(TOKEN_KEY);
export const deleteToken = () => SecureStore.deleteItemAsync(TOKEN_KEY);

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
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
    }
    return Promise.reject(error);
  },
);

export default api;
