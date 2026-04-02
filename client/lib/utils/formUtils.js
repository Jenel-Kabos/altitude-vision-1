/**
 * Transforme le formData d'une propriété en FormData prêt à être envoyé via API
 * @param {Object} formData - Données du formulaire
 * @param {Array} existingImages - URLs des images existantes à conserver
 * @param {Array} newImages - Fichiers image à ajouter
 * @returns {FormData} formData prêt à être envoyé
 */
export const buildPropertyFormData = (formData, existingImages = [], newImages = []) => {
  const data = new FormData();

  // Champs simples
  const simpleFields = [
    "title",
    "description",
    "price",
    "pole",
    "status",
    "availability",
    "type",
    "address_district",
    "address_street",
    "address_city",
    "surface",
    "bedrooms",
    "bathrooms"
  ];

  simpleFields.forEach(field => {
    if (formData[field] !== undefined && formData[field] !== null) {
      data.append(field, formData[field]);
    }
  });

  // Amenities (tableau)
  if (formData.amenities) {
    const amenitiesArray = Array.isArray(formData.amenities)
      ? formData.amenities
      : formData.amenities.split(",").map(a => a.trim()).filter(Boolean);
    data.append("amenities", JSON.stringify(amenitiesArray));
  }

  // Images existantes
  if (existingImages.length > 0) {
    data.append("existingImages", JSON.stringify(existingImages));
  }

  // Nouvelles images
  if (newImages.length > 0) {
    newImages.forEach(file => {
      data.append("images", file);
    });
  }

  // Localisation
  if (formData.latitude != null && formData.longitude != null) {
    data.append(
      "location",
      JSON.stringify({ type: "Point", coordinates: [formData.longitude, formData.latitude] })
    );
    data.append("latitude", formData.latitude);
    data.append("longitude", formData.longitude);
  }

  return data;
};
