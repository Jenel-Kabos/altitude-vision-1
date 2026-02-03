// src/utils/axiosConfig.js ou src/api/axios.js
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api', // Votre URL API
});

// Intercepteur pour ajouter le token à chaque requête
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;