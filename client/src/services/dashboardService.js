// src/services/dashboardService.js
import api from "./api";

/**
 * Récupère le token depuis localStorage
 */
const getToken = () => localStorage.getItem("token");

/**
 * Récupère les statistiques globales du Dashboard
 * (biens, événements, services)
 */
export const getDashboardStats = async () => {
  try {
    const token = getToken();
    if (!token) throw new Error("Token manquant, utilisateur non connecté");

    const response = await api.get("/dashboard/stats", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.log("📊 [dashboardService] Réponse complète:", response.data);

    // ✅ CORRECTION : Accès correct à response.data.data.stats
    const stats = response.data?.data?.stats || { Altimmo: 0, MilaEvents: 0, Altcom: 0 };
    
    console.log("📊 [dashboardService] Stats extraites:", stats);
    
    return stats;
  } catch (error) {
    console.error("❌ [dashboardService] Erreur lors du chargement des statistiques :", error);

    // On peut propager l'erreur pour que le composant l'affiche/redirige
    throw error;
  }
};