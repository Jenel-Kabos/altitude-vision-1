// client/src/services/testimonialService.js
import api from './api'; // Assure-toi que le chemin vers api.js est bon

export const getAllTestimonials = async () => {
  try {
    const response = await api.get('/reviews');

    // 🔍 DEBUG : Regarde dans la console du navigateur ce qui s'affiche ici
    console.log("📦 Structure API Reviews reçue :", response.data);

    let reviewsData = [];

    // 🛡️ Logique blindée pour trouver le tableau (Array)
    if (Array.isArray(response.data)) {
        // Cas 1: Le backend renvoie directement [ ... ]
        reviewsData = response.data;
    } else if (Array.isArray(response.data.data)) {
        // Cas 2: Le backend renvoie { data: [ ... ] }
        reviewsData = response.data.data;
    } else if (response.data.data && Array.isArray(response.data.data.reviews)) {
        // Cas 3: Le backend renvoie { data: { reviews: [ ... ] } }
        reviewsData = response.data.data.reviews;
    } else if (response.data.reviews && Array.isArray(response.data.reviews)) {
        // Cas 4: Le backend renvoie { reviews: [ ... ] }
        reviewsData = response.data.reviews;
    }

    // Si on a toujours pas de tableau, on renvoie vide pour éviter le crash .filter()
    if (!Array.isArray(reviewsData)) {
        console.warn("⚠️ Aucun tableau d'avis trouvé dans la réponse API.");
        return [];
    }

    // Maintenant on peut filtrer sans risque de crash
    // Adapte la condition selon tes champs (ex: isVisible, status === 'Approved', etc.)
    return reviewsData.filter(review => review.isVisible !== false); 

  } catch (error) {
    console.error("❌ [TestimonialService] Erreur lors de la récupération :", error);
    // Important : Retourner un tableau vide en cas d'erreur pour ne pas casser l'UI
    return []; 
  }
};