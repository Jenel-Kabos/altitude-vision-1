// client/lib/services/rentalPropertyService.js — Sprint A (séparation Vente/Location)
import api from './api';

/**
 * Crée une annonce Location complète (Property + RentalManagement) depuis le
 * dashboard admin, en un seul appel atomique côté backend.
 * @param {FormData} formData
 * @returns {Promise<{property, rental}>}
 */
export const createFullRentalProperty = async (formData) => {
  const res = await api.post('/rental-properties', formData);
  return res.data.data;
};

/**
 * Met à jour une annonce Location complète existante.
 * @param {string} propertyId
 * @param {FormData} formData
 */
export const updateFullRentalProperty = async (propertyId, formData) => {
  const res = await api.put(`/rental-properties/${propertyId}`, formData);
  return res.data.data;
};
