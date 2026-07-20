// client/lib/services/salePropertyService.js — Sprint A (séparation Vente/Location)
import api from './api';

/**
 * Crée une annonce Vente complète (Property + SaleManagement) depuis le
 * dashboard admin, en un seul appel atomique côté backend.
 * @param {FormData} formData
 * @returns {Promise<{property, sale}>}
 */
export const createFullSaleProperty = async (formData) => {
  const res = await api.post('/sale-properties', formData);
  return res.data.data;
};

/**
 * Met à jour une annonce Vente complète existante.
 * @param {string} propertyId
 * @param {FormData} formData
 */
export const updateFullSaleProperty = async (propertyId, formData) => {
  const res = await api.put(`/sale-properties/${propertyId}`, formData);
  return res.data.data;
};
