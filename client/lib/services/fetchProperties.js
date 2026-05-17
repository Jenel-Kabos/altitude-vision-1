// --- src/services/fetchProperties.js ---
import { getAllProperties as getPropertiesFromAPI } from './propertyService';

/**
 * Récupère les propriétés avec filtres
 * @param {string} query - Paramètres optionnels (ex: status=Disponible)
 * @param {Array} allowedRoles - Rôles dont les publications doivent être affichées
 * @returns {Promise<Array>} - Liste de biens
 */
export const fetchProperties = async (query = '?status=Disponible&sort=-createdAt', allowedRoles = ['Admin', 'Propriétaire']) => {
  try {
    let properties = await getPropertiesFromAPI(query);

    // Filtrer les propriétés selon le rôle du créateur
    properties = properties.filter(prop => allowedRoles.includes(prop.creatorRole));

    return properties;
  } catch (error) {
    console.error('Erreur lors de la récupération des propriétés :', error);
    throw error;
  }
};
