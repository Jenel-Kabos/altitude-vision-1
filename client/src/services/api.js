import axios from "axios";

// Base URL dynamique et sûre
const BASE_URL = typeof import.meta === 'undefined' 
  ? "http://localhost:5000/api" 
  : import.meta.env.VITE_API_URL || "http://localhost:5000/api";

console.log("🔧 API Base URL configurée:", BASE_URL);

// Instance Axios principale
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000, // 30 secondes pour l'upload de fichiers
});

// ⭐ CORRECTION CRITIQUE : Intercepteur de requête amélioré
api.interceptors.request.use(
  (config) => {
    // Récupérer le token à CHAQUE requête (pas de cache)
    const token = typeof window !== 'undefined' ? localStorage.getItem("token") : null;
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log("🔑 Token ajouté à la requête:", config.method.toUpperCase(), config.url);
    } else {
      console.warn("⚠️ Aucun token trouvé pour:", config.method.toUpperCase(), config.url);
    }

    // Gérer FormData correctement
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
      console.log("📤 Requête FormData envoyée:", config.method.toUpperCase(), config.url);
      
      // Log du contenu du FormData pour debug
      if (config.data) {
        console.log("📦 Contenu du FormData:");
        let fileCount = 0;
        for (let pair of config.data.entries()) {
          if (pair[1] instanceof File) {
            fileCount++;
            console.log(`   ${pair[0]}: [File: ${pair[1].name}, ${(pair[1].size / 1024).toFixed(2)} KB]`);
          } else {
            console.log(`   ${pair[0]}: ${pair[1]}`);
          }
        }
        console.log(`📸 Total de fichiers dans FormData: ${fileCount}`);
      }
    } else {
      console.log("📤 Requête JSON envoyée:", config.method.toUpperCase(), config.url);
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
    console.log("✅ Réponse reçue:", response.status, response.config.url);
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
            console.log("🔄 Redirection vers /login...");
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