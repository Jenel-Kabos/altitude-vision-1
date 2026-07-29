import api from './api';
import { normalizePropertyDetail } from '../utils/normalizePropertyDetail';
const apiFormHeaders = () => ({}); // On simule la fonction

/**
 * Récupère toutes les propriétés avec filtres optionnels
 * @param {Object} options - Options de filtrage (pole, status, type, limit, page, sort)
 * @returns {Promise<Array>} - Tableau de propriétés
 */
export const getAllProperties = async (options = {}) => {
  try {
    const { pole, status, limit, page, sort, type, dashboardClassification } = options;
    let query = '?';
    if (pole) query += `pole=${encodeURIComponent(pole)}&`;
    if (status) query += `status=${encodeURIComponent(status)}&`;
    if (type) query += `type=${encodeURIComponent(type)}&`;
    if (limit) query += `limit=${limit}&`;
    if (page) query += `page=${page}&`;
    if (sort) query += `sort=${encodeURIComponent(sort)}&`;
    if (dashboardClassification) query += 'dashboardClassification=1&';
    if (query.endsWith('&') || query.endsWith('?')) query = query.slice(0, -1);

    
    const response = await api.get(`/properties${query === '?' ? '' : query}`);
    const properties = response.data?.data?.properties || [];
    
    
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
/**
 * Récupère les biens avec filtres complets (utilisé par AltimmoPage/AltimmoAnnonces et
 * PropertiesPage web) — nomenclature canonique (audit filtrage Altimmo) : `offerType`,
 * `propertyType`, `city`, `arrondissement`, `minPrice`, `maxPrice`, `search`, `sort`, `page`,
 * `limit`. Les anciens noms `transaction`/`type` restent acceptés en entrée de CETTE fonction
 * (alias, jamais envoyés tels quels à l'API) pour ne pas casser les appelants existants
 * (`PropertiesPage.jsx`, hors périmètre de cette harmonisation) — voir §10 de l'audit.
 */
export const getPropertiesWithFilters = async (params = {}) => {
  try {
    const offerType    = params.offerType    ?? params.transaction;
    const propertyType = params.propertyType ?? params.type;

    const qs = new URLSearchParams();
    if (params.search)                                qs.set('search',       params.search.trim());
    if (offerType && offerType !== 'tous')             qs.set('offerType',    offerType);
    if (propertyType && propertyType !== 'tous')       qs.set('propertyType', propertyType);
    if (params.city   && params.city !== 'Toutes')     qs.set('city',         params.city);
    if (params.arrondissement && params.arrondissement !== 'Tous') qs.set('arrondissement', params.arrondissement);
    if (params.minPrice > 0)                           qs.set('minPrice', String(params.minPrice));
    if (params.maxPrice && params.maxPrice < 500_000_000) qs.set('maxPrice', String(params.maxPrice));
    qs.set('page',  String(params.page  || 1));
    qs.set('limit', String(params.limit || 12));
    if (params.sort) qs.set('sort', params.sort);

    const response = await api.get(`/properties?${qs.toString()}`);
    return {
      properties: response.data?.data?.properties || [],
      total:      response.data?.data?.total || response.data?.total || 0,
    };
  } catch (error) {
    console.error('❌ [propertyService] getPropertiesWithFilters:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Recherche unifiée Altimmo (correctif architecture 2026-07-25) — utilisée par
 * `AltimmoPage.jsx`/`AltimmoAnnonces.jsx`. Appelle `GET /api/altimmo/search`, qui choisit la
 * source de données selon `offerType` : Property (vente/location/tous) ou Accommodation
 * (hebergement, avec sa vraie catégorie `accommodationType`) — jamais les deux mélangés à tort.
 * `propertyType` et `accommodationType` sont mutuellement exclusifs : n'envoyer que celui
 * pertinent pour l'`offerType` sélectionné (le composant appelant s'en charge).
 */
export const searchAltimmo = async (params = {}) => {
  try {
    const qs = new URLSearchParams();
    if (params.search)                                    qs.set('search', params.search.trim());
    if (params.offerType && params.offerType !== 'tous')   qs.set('offerType', params.offerType);
    if (params.propertyType && params.propertyType !== 'tous') qs.set('propertyType', params.propertyType);
    if (params.accommodationType && params.accommodationType !== 'tous') qs.set('accommodationType', params.accommodationType);
    if (params.city && params.city !== 'Toutes')          qs.set('city', params.city);
    if (params.arrondissement && params.arrondissement !== 'Tous') qs.set('arrondissement', params.arrondissement);
    if (params.minPrice > 0)                              qs.set('minPrice', String(params.minPrice));
    if (params.maxPrice && params.maxPrice < 500_000_000) qs.set('maxPrice', String(params.maxPrice));
    qs.set('page',  String(params.page  || 1));
    qs.set('limit', String(params.limit || 12));
    if (params.sort) qs.set('sort', params.sort);

    const response = await api.get(`/altimmo/search?${qs.toString()}`);
    return {
      properties: response.data?.data?.properties || [],
      total:      response.data?.data?.total || response.data?.total || 0,
    };
  } catch (error) {
    console.error('❌ [propertyService] searchAltimmo:', error.response?.data || error.message);
    throw error;
  }
};

export const getPropertyById = async (propertyId, config = {}) => {
  try {
    
    const response = await api.get(`/properties/${propertyId}`, config);
    const property = response.data?.data?.property || response.data?.data?.properties || null;
    
    
    return normalizePropertyDetail(property);
  } catch (error) {
    if (error.code !== 'ERR_CANCELED') console.error('[PropertyDetail]', {
      page: 'property-detail', propertyId, phase: 'fetch', status: error.response?.status || null,
      type: error.name || 'Error', message: error.message,
    });
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
    
    const response = await api.post('/properties', propertyData, { headers: apiFormHeaders() });
    const property = response.data?.data?.property;
    
    
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
    
    const response = await api.put(`/properties/${propertyId}`, propertyData, { headers: apiFormHeaders() });
    const property = response.data?.data?.property;
    
    
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
    
    await api.delete(`/properties/${propertyId}`);
    
  } catch (error) {
    console.error(`❌ [propertyService] Erreur lors de la suppression de la propriété ${propertyId} :`, error.response?.data || error.message);
    throw error;
  }
};

/**
 * Toggle le statut "recommandé" d'une propriété (Admin)
 * @param {String} propertyId - ID de la propriété
 * @param {Boolean} recommande - Nouvelle valeur
 * @returns {Promise<Object>} - Propriété mise à jour
 */
export const likeProperty = async (propertyId) => {
  const response = await api.post(`/properties/${propertyId}/like`);
  return response.data;
};

export const shareProperty = async (propertyId) => {
  const response = await api.post(`/properties/${propertyId}/share`);
  return response.data;
};

export const toggleRecommande = async (propertyId, recommande) => {
  try {
    const response = await api.patch(`/properties/${propertyId}/recommande`, { recommande });
    return response.data?.data?.property;
  } catch (error) {
    console.error(`❌ [propertyService] Erreur toggle recommandé ${propertyId}:`, error.response?.data || error.message);
    throw error;
  }
};

/**
 * Récupère les propriétés de l'utilisateur connecté
 * @returns {Promise<Array>} - Tableau de propriétés de l'utilisateur
 */
export const getMyProperties = async () => {
  try {
    
    const response = await api.get('/properties/my-properties');
    const properties = response.data?.data?.properties || [];
    
    
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
  
  try {
    const results = {};
    const poleList = Array.isArray(poles) ? poles : [poles];
    
    // Filtrer les pôles valides
    const validPoles = poleList.filter(pole => pole && typeof pole === 'string' && pole.trim().length > 0);
    

    if (validPoles.length === 0) {
      console.warn("⚠️ [propertyService] Aucun pôle valide trouvé");
      return {};
    }

    // Lance tous les appels en parallèle pour de meilleures performances
    
    const propertiesPromises = validPoles.map((pole) => {
      return getLatestPropertiesByPole(pole, limit);
    });
    
    const allProperties = await Promise.all(propertiesPromises);
    

    // Mappe les résultats dans l'objet { Pole: [annonces] }
    validPoles.forEach((pole, index) => {
      results[pole] = allProperties[index];
    });
    
    return results;
    
  } catch (error) {
    console.error('❌ [propertyService] Erreur lors de l\'orchestration:', error.response?.data || error.message);
    
    // En cas d'échec global, retourner un objet vide
    return {};
  }
};
