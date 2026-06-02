import axios from "axios";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://altitude-vision.onrender.com/api";


// Instance Axios principale
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 90000, // 90 secondes pour l'upload de fichiers
});

// ⭐ CORRECTION CRITIQUE : Intercepteur de requête amélioré
api.interceptors.request.use(
  (config) => {
    // Récupérer le token à CHAQUE requête (pas de cache)
    const token = typeof window !== 'undefined' ? localStorage.getItem("token") : null;
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Gérer FormData correctement
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
      
      // Log du contenu du FormData pour debug
      if (config.data) {
        let fileCount = 0;
        for (let pair of config.data.entries()) {
          if (pair[1] instanceof File) {
            fileCount++;
          } else {
          }
        }
      }
    } else {
    }

    return config;
  },
  (error) => {
    console.error("❌ Erreur dans l'intercepteur de requête:", error);
    return Promise.reject(error);
  }
);

// ⭐ CORRECTION CRITIQUE : Intercepteur de réponse avec gestion 401
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      
      console.error(`❌ Erreur ${status}:`, data?.message || error.message);
      console.error("   URL:", error.config?.url);
      console.error("   Méthode:", error.config?.method?.toUpperCase());
      
      if (data?.errors) {
        console.error("   Détails des erreurs:", data.errors);
      }

      // 🔒 Token expiré ou invalide (401) - Déconnexion automatique
      if (status === 401) {
        console.warn("🔒 Token invalide détecté (401) - Déconnexion automatique");
        
        // Nettoyer le localStorage
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          
          // Rediriger vers la page de connexion si on n'y est pas déjà
          if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
            window.location.href = '/login';
          }
        }
      }

      // ⛔ Accès interdit (403)
      if (status === 403) {
        console.warn("⛔ Accès refusé (403) - Permissions insuffisantes");
      }

      // 🔍 Ressource non trouvée (404)
      if (status === 404) {
        console.warn("🔍 Ressource non trouvée (404)");
      }

      // 💥 Erreur serveur (500+)
      if (status >= 500) {
        console.error("💥 Erreur serveur (500+):", data?.message || "Erreur interne");
        if (data?.stack) {
          console.error("   Stack:", data.stack);
        }
      }
      
    } else if (error.request) {
      console.error("🌐 Aucune réponse du serveur");
      console.error("   URL tentée:", error.config?.url);
      console.error("   Base URL:", BASE_URL);
      console.error("   Message:", error.message);
      console.error("   Code:", error.code);
      
      if (error.code === 'ECONNABORTED') {
        console.error("⏱️ La requête a expiré (timeout)");
      }
      
    } else {
      console.error("⚙️ Erreur de configuration de la requête:", error.message);
    }

    return Promise.reject(error);
  }
);

export default api;
export { BASE_URL };