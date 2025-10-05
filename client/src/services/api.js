import axios from 'axios';

// 1. Création d'une instance d'Axios avec une configuration de base
const api = axios.create({
  // URL de base de notre serveur backend
  baseURL: 'http://localhost:5000/api',
  // Headers par défaut pour les requêtes
  headers: {
    'Content-Type': 'application/json',
  },
});

/*
  2. Intercepteur de Requête (Request Interceptor)
  Ce code s'exécute AVANT chaque requête envoyée. Son rôle est d'ajouter 
  automatiquement le token d'authentification (JWT) si l'utilisateur est connecté.
  Cela évite de devoir l'ajouter manuellement dans chaque composant.
*/
api.interceptors.request.use(
  (config) => {
    const userInfo = JSON.parse(localStorage.getItem('userInfo'));

    if (userInfo && userInfo.token) {
      config.headers.Authorization = `Bearer ${userInfo.token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/*
  3. Intercepteur de Réponse (Response Interceptor) - Optionnel
  Ce code s'exécute APRÈS chaque réponse reçue. Il peut gérer globalement 
  les erreurs. Par exemple, si le token a expiré (erreur 401), il peut
  déconnecter l'utilisateur automatiquement.
*/
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('userInfo');
      // Redirige vers la page de connexion, ce qui rafraîchit l'état de l'application
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;