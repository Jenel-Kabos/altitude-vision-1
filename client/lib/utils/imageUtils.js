// src/utils/imageUtils.js

/**
 * Valide et retourne une URL d'image sécurisée
 * @param {string} imageUrl - URL de l'image à valider
 * @param {string} fallback - Image par défaut si invalide
 * @returns {string} URL validée ou image par défaut
 */
export const getValidImageUrl = (imageUrl, fallback = 'https://placehold.co/600x400/60A5FA/FFFFFF?text=No+Image') => {
  // Vérifier que l'URL existe et n'est pas vide
  if (!imageUrl || typeof imageUrl !== 'string') {
    console.warn('⚠️ [ImageUtils] URL manquante ou invalide');
    return fallback;
  }

  // Vérifier que l'URL ne pointe pas vers un dossier (se termine par /)
  if (imageUrl.endsWith('/')) {
    console.warn('⚠️ [ImageUtils] URL pointe vers un dossier:', imageUrl);
    return fallback;
  }

  // Vérifier la longueur minimale (éviter les URLs trop courtes)
  if (imageUrl.length < 10) {
    console.warn('⚠️ [ImageUtils] URL trop courte:', imageUrl);
    return fallback;
  }

  // Si c'est une URL complète (commence par http:// ou https://)
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }

  // Si c'est un chemin relatif, s'assurer qu'il commence par /
  if (!imageUrl.startsWith('/')) {
    return '/' + imageUrl;
  }

  return imageUrl;
};

/**
 * Récupère la première image valide d'un tableau d'images
 * @param {Array<string>} images - Tableau d'URLs d'images
 * @param {string} fallback - Image par défaut
 * @returns {string} Première image valide ou fallback
 */
export const getFirstValidImage = (images, fallback = 'https://placehold.co/600x400/60A5FA/FFFFFF?text=No+Image') => {
  if (!Array.isArray(images) || images.length === 0) {
    return fallback;
  }

  // Chercher la première image valide
  for (const img of images) {
    const validUrl = getValidImageUrl(img, null);
    if (validUrl && validUrl !== fallback) {
      return validUrl;
    }
  }

  // Aucune image valide trouvée
  return fallback;
};

/**
 * Nettoie un tableau d'URLs d'images en retirant les invalides
 * @param {Array<string>} images - Tableau d'URLs d'images
 * @returns {Array<string>} Tableau nettoyé
 */
export const cleanImageArray = (images) => {
  if (!Array.isArray(images)) {
    return [];
  }

  return images.filter(img => {
    if (!img || typeof img !== 'string') return false;
    if (img.endsWith('/')) return false;
    if (img.length < 10) return false;
    return true;
  });
};