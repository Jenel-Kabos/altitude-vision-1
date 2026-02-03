import api from './api';
const apiFormHeaders = () => ({}); // On simule la fonction

/**
 * Récupère toutes les propriétés avec filtres optionnels
 * @param {Object} options - Options de filtrage (pole, status, type, limit, page, sort)
 * @returns {Promise<Array>} - Tableau de propriétés
 */
export const getAllProperties = async (options = {}) => {
  try {
    const { pole, status, limit, page, sort, type } = options;
    let query = '?';
    if (pole) query += `pole=${encodeURIComponent(pole)}&`;
    if (status) query += `status=${encodeURIComponent(status)}&`;
    if (type) query += `type=${encodeURIComponent(type)}&`;
    if (limit) query += `limit=${limit}&`;
    if (page) query += `page=${page}&`;
    if (sort) query += `sort=${encodeURIComponent(sort)}&`;
    if (query.endsWith('&') || query.endsWith('?')) query = query.slice(0, -1);

    console.log(`📡 [propertyService] getAllProperties - Requête: /properties${query}`);
    
    const response = await api.get(`/properties${query === '?' ? '' : query}`);
    const properties = response.data?.data?.properties || [];
    
    console.log(`✅ [propertyService] getAllProperties - ${properties.length} propriété(s) récupérée(s)`);
    
    return properties;
  } catch (error) {
    console.error('❌ [propertyService] Erreur lors de la récupération des annonces :', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Récupère une propriété par son ID
 * @param {String} propertyId - ID de la propriété
 * @returns {Promise<Object>} - Objet propriété
 */
export const getPropertyById = async (propertyId) => {
  try {
    console.log(`📡 [propertyService] getPropertyById - ID: ${propertyId}`);
    
    const response = await api.get(`/properties/${propertyId}`);
    const property = response.data?.data?.property || response.data?.data?.properties || null;
    
    console.log(`✅ [propertyService] getPropertyById - Propriété récupérée:`, property?.title || 'Non trouvée');
    
    return property;
  } catch (error) {
    console.error(`❌ [propertyService] Erreur lors de la récupération de l'annonce ${propertyId} :`, error.response?.data || error.message);
    throw error;
  }
};

/**
 * Crée une nouvelle propriété
 * @param {Object} propertyData - Données de la propriété
 * @returns {Promise<Object>} - Propriété créée
 */
export const addProperty = async (propertyData) => {
  try {
    console.log(`📡 [propertyService] addProperty - Création d'une nouvelle propriété`);
    
    const response = await api.post('/properties', propertyData, { headers: apiFormHeaders() });
    const property = response.data?.data?.property;
    
    console.log(`✅ [propertyService] addProperty - Propriété créée:`, property?.title);
    
    return property;
  } catch (error) {
    console.error('❌ [propertyService] Erreur lors de la création de la propriété :', error.response?.data || error.message);
    throw error;
  }
};

// Alias pour addProperty
export const createProperty = addProperty;

/**
 * Met à jour une propriété existante
 * @param {String} propertyId - ID de la propriété
 * @param {Object} propertyData - Nouvelles données
 * @returns {Promise<Object>} - Propriété mise à jour
 */
export const updateProperty = async (propertyId, propertyData) => {
  try {
    console.log(`📡 [propertyService] updateProperty - ID: ${propertyId}`);
    
    const response = await api.put(`/properties/${propertyId}`, propertyData, { headers: apiFormHeaders() });
    const property = response.data?.data?.property;
    
    console.log(`✅ [propertyService] updateProperty - Propriété mise à jour:`, property?.title);
    
    return property;
  } catch (error) {
    console.error(`❌ [propertyService] Erreur lors de la mise à jour de la propriété ${propertyId}:`, error.response?.data || error.message);
    throw error;
  }
};

/**
 * Supprime une propriété
 * @param {String} propertyId - ID de la propriété à supprimer
 * @returns {Promise<void>}
 */
export const deleteProperty = async (propertyId) => {
  try {
    console.log(`📡 [propertyService] deleteProperty - ID: ${propertyId}`);
    
    await api.delete(`/properties/${propertyId}`);
    
    console.log(`✅ [propertyService] deleteProperty - Propriété supprimée avec succès`);
  } catch (error) {
    console.error(`❌ [propertyService] Erreur lors de la suppression de la propriété ${propertyId} :`, error.response?.data || error.message);
    throw error;
  }
};

/**
 * Récupère les propriétés de l'utilisateur connecté
 * @returns {Promise<Array>} - Tableau de propriétés de l'utilisateur
 */
export const getMyProperties = async () => {
  try {
    console.log(`📡 [propertyService] getMyProperties - Récupération des propriétés de l'utilisateur`);
    
    const response = await api.get('/properties/my-properties');
    const properties = response.data?.data?.properties || [];
    
    console.log(`✅ [propertyService] getMyProperties - ${properties.length} propriété(s) récupérée(s)`);
    
    return properties;
  } catch (error) {
    console.error("❌ [propertyService] Erreur lors de la récupération de 'mes propriétés' :", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Récupère les dernières propriétés pour un pôle spécifique
 * @param {String} pole - Nom du pôle (Altimmo, MilaEvents, Altcom)
 * @param {Number} limit - Nombre maximum de propriétés à récupérer
 * @returns {Promise<Array>} - Tableau de propriétés
 */
export const getLatestPropertiesByPole = async (pole, limit = 5) => {
  console.log(`📡 [propertyService] getLatestPropertiesByPole appelé pour: ${pole}, limite: ${limit}`);
  
  // Validation du pôle
  if (!pole || typeof pole !== 'string' || pole.trim().length === 0) {
    console.warn("⚠️ [propertyService] Pôle non valide:", pole);
    return [];
  }
  
  try {
    // ✅ Utiliser la nouvelle route /latest avec les paramètres
    const response = await api.get('/properties/latest', {
      params: {
        pole: pole,
        limit: limit
      }
    });
    
    const properties = response.data?.data?.properties || [];
    
    console.log(`✅ [propertyService] ${pole}: ${properties.length} annonce(s) récupérée(s)`);
    
    // Afficher les titres des propriétés récupérées pour le debug
    if (properties.length > 0) {
      console.log(`   → Propriétés récupérées:`, properties.map(p => ({
        id: p._id,
        title: p.title,
        pole: p.pole,
        createdAt: p.createdAt
      })));
    } else {
      console.log(`   ℹ️ Aucune propriété trouvée pour ${pole}`);
    }
    
    return properties;
    
  } catch (error) {
    console.error(`❌ [propertyService] Erreur pour ${pole}:`, error.response?.data || error.message);
    console.error(`   → Status: ${error.response?.status}`);
    console.error(`   → URL appelée: /properties/latest?pole=${pole}&limit=${limit}`);
    
    // Retourne un tableau vide en cas d'échec pour ne pas bloquer les autres pôles
    return []; 
  }
};

/**
 * Récupère les dernières propriétés pour plusieurs pôles
 * @param {Array<String>} poles - Liste des pôles (ex: ["Altimmo", "MilaEvents", "Altcom"])
 * @param {Number} limit - Nombre maximum de propriétés par pôle
 * @returns {Promise<Object>} - Objet avec les propriétés groupées par pôle { "Altimmo": [...], "MilaEvents": [...], ... }
 */
export const getLatestPropertiesByPoles = async (poles = [], limit = 5) => {
  console.log("🚀 [propertyService] getLatestPropertiesByPoles appelé avec:", { poles, limit });
  
  try {
    const results = {};
    const poleList = Array.isArray(poles) ? poles : [poles];
    
    // Filtrer les pôles valides
    const validPoles = poleList.filter(pole => pole && typeof pole === 'string' && pole.trim().length > 0);
    
    console.log("📋 [propertyService] Pôles valides à traiter:", validPoles);

    if (validPoles.length === 0) {
      console.warn("⚠️ [propertyService] Aucun pôle valide trouvé");
      return {};
    }

    // Lance tous les appels en parallèle pour de meilleures performances
    console.log("⏳ [propertyService] Lancement des requêtes parallèles...");
    
    const propertiesPromises = validPoles.map((pole) => {
      console.log(`   🔄 Requête pour: ${pole}`);
      return getLatestPropertiesByPole(pole, limit);
    });
    
    const allProperties = await Promise.all(propertiesPromises);
    
    console.log("📦 [propertyService] Toutes les requêtes terminées");

    // Mappe les résultats dans l'objet { Pole: [annonces] }
    validPoles.forEach((pole, index) => {
      results[pole] = allProperties[index];
      console.log(`   ✨ ${pole}: ${allProperties[index].length} annonce(s) ajoutée(s) aux résultats`);
    });
    
    console.log("🎉 [propertyService] Résultats finaux:", {
      nombreDePoles: Object.keys(results).length,
      résumé: Object.entries(results).map(([pole, props]) => `${pole}: ${props.length}`).join(', '),
      totalAnnonces: Object.values(results).reduce((acc, props) => acc + props.length, 0)
    });
    
    return results;
    
  } catch (error) {
    console.error('❌ [propertyService] Erreur lors de l\'orchestration:', error.response?.data || error.message);
    
    // En cas d'échec global, retourner un objet vide
    return {};
  }
};