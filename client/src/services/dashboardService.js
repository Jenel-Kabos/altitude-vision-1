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

    // Retourne les données ou valeurs par défaut si vide
    return response.data?.data || { Altimmo: 0, MilaEvents: 0, Altcom: 0 };
  } catch (error) {
    console.error("Erreur lors du chargement des statistiques :", error);

    // On peut propager l'erreur pour que le composant l'affiche/redirige
    throw error;
  }
};
