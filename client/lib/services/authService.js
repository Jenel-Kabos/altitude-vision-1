// --- src/pages/Profile/authService.js ---
import api from './api';

/**
 * Inscription d’un nouvel utilisateur
 */
export const register = async (userData) => {
  try {
    const response = await api.post('/users/signup', userData, {
      headers: userData instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {},
    });
    const { token, data } = response.data;

    if (token && data?.user) {
      saveToken(token);
      saveUser(data.user);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }

    return response.data;
  } catch (error) {
    console.error("Erreur lors de l'inscription:", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Connexion
 */
export const login = async (credentials) => {
  try {
    const response = await api.post('/users/login', credentials);
    const { token, data } = response.data;

    if (token && data?.user) {
      saveToken(token);
      saveUser(data.user);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }

    return response.data;
  } catch (error) {
    console.error("Erreur lors de la connexion:", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Déconnexion
 */
export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  delete api.defaults.headers.common['Authorization'];
};

/**
 * Vérifie la session
 */
export const isAuthenticated = () => !!localStorage.getItem('token');

/**
 * Récupère les infos utilisateur
 */
export const getCurrentUser = () => {
  try {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  } catch (error) {
    console.error("Impossible de lire l'utilisateur:", error);
    return null;
  }
};

/**
 * Sauvegarde l'utilisateur dans le localStorage
 */
export const saveUser = (user) => {
  try {
    localStorage.setItem('user', JSON.stringify(user));
  } catch (error) {
    console.error("Impossible de sauvegarder l'utilisateur:", error);
  }
};

/**
 * Sauvegarde le token dans le localStorage
 */
export const saveToken = (token) => {
  try {
    localStorage.setItem('token', token);
  } catch (error) {
    console.error("Impossible de sauvegarder le token:", error);
  }
};
