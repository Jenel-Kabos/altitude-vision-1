import axios from "axios";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://altitude-vision.onrender.com/api";

// Endpoints de polling/comptage : echec silencieux, pas de redirect auto
const SILENT_URLS = [
  "/internal-mails/count/unread",
  "/notifications/count",
  "/conversations/count/unread",
];

// Evite que plusieurs 401 simultanement declenchent plusieurs redirects
let _autoLogoutPending = false;
let _validatedPlatformTenantId = null;

export const setValidatedPlatformTenant = (tenantId) => { _validatedPlatformTenantId = tenantId || null; };
export const clearValidatedPlatformTenant = () => { _validatedPlatformTenantId = null; };

// Instance Axios principale
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 90000, // 90 secondes pour l'upload de fichiers
});

api.interceptors.request.use(
  (config) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // PLATFORM-ADMIN-1 — sélection de tenant explicite par un PlatformOperator
    // (voir platformOperatorService.js côté client). N'a aucun effet pour un
    // utilisateur ordinaire : le backend n'accorde cette portée qu'à un
    // opérateur réellement actif, jamais déduit de la seule présence de cet
    // en-tête (voir server/middleware/tenantContext.js).
    if (_validatedPlatformTenantId && !config.platformScoped) {
      config.headers["X-Platform-Tenant-Id"] = _validatedPlatformTenantId;
    } else if (config.platformScoped) {
      delete config.headers["X-Platform-Tenant-Id"];
    }

    if (config.data instanceof FormData) {
      delete config.headers["Content-Type"];
    }

    return config;
  },
  (error) => {
    console.error("Erreur dans l'intercepteur de requete:", error);
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      const requestUrl = error.config?.url || "";
      const isSilentUrl = SILENT_URLS.some(u => requestUrl.includes(u));

      // 🔒 Token expire ou invalide (401)
      if (status === 401) {
        if (isSilentUrl) {
          // URLs de polling : nettoyer le token silencieusement + notifier AuthContext
          // Pas de console.error, pas de redirect
          if (typeof window !== "undefined" && localStorage.getItem("token")) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            localStorage.removeItem("platformOperatorTenantSelection");
            localStorage.removeItem("platformOperatorTenantId");
            clearValidatedPlatformTenant();
            window.dispatchEvent(new CustomEvent("altimmo:auth:expired"));
          }
        } else if (!_autoLogoutPending && typeof window !== "undefined") {
          _autoLogoutPending = true;
          console.warn("🔒 Token invalide (401) — Deconnexion automatique");
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          localStorage.removeItem("platformOperatorTenantSelection");
          localStorage.removeItem("platformOperatorTenantId");
          clearValidatedPlatformTenant();
          const AUTH_PAGES = ["/login", "/register", "/"];
          if (!AUTH_PAGES.includes(window.location.pathname)) {
            window.location.href = "/login";
          }
          setTimeout(() => { _autoLogoutPending = false; }, 5000);
        }
      } else {
        console.error(`Erreur ${status}:`, data?.message || error.message);
        console.error("   URL:", requestUrl);
        console.error("   Methode:", error.config?.method?.toUpperCase());
        if (data?.errors) console.error("   Details:", data.errors);
        if (status === 403) console.warn("⛔ Acces refuse (403)");
        if (status === 404) console.warn("🔍 Ressource non trouvee (404)");
        if (status >= 500) {
          console.error("💥 Erreur serveur:", data?.message || "Erreur interne");
          if (data?.stack) console.error("   Stack:", data.stack);
        }
      }
    } else if (error.request) {
      console.error("🌐 Aucune reponse du serveur:", error.config?.url, error.code);
    } else {
      console.error("⚙️ Erreur de configuration:", error.message);
    }

    return Promise.reject(error);
  }
);

export default api;
export { BASE_URL };
