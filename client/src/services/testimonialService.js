// src/services/testimonialService.js
import api from "./api"; // Assurez-vous que ce fichier pointe bien vers votre configuration Axios

// Route correspondant à votre backend (server.js > reviewRoutes)
const API_URL = "/reviews";

export const getAllTestimonials = async () => {
    try {
        // 1. Récupération des données brutes depuis le backend
        const response = await api.get(API_URL);

        // 2. Gestion de la structure de réponse (votre API renvoie souvent { data: [...] })
        const rawReviews = response.data.data || response.data || [];

        // 3. Transformation pour adapter au format attendu par le Design (Testimonials.jsx)
        const formattedTestimonials = rawReviews
            // Optionnel : on ne garde que les avis avec une bonne note si le champ existe
            .filter(review => !review.rating || review.rating >= 4) 
            .map(review => ({
                id: review._id,
                // On récupère le nom depuis l'objet user, ou on met un défaut
                name: review.user ? `${review.user.firstname} ${review.user.lastname}` : "Client Vérifié",
                // On détermine un rôle fictif ou réel
                role: review.user?.role === 'admin' ? 'Équipe Altitude' : 'Client Altimmo/Mila/Altcom', 
                // On cherche le commentaire dans les différents champs possibles
                message: review.comment || review.review || review.content || review.text || "Service excellent !",
                // L'avatar (on s'assure d'avoir l'URL complète si c'est un chemin relatif)
                avatar: review.user?.avatar 
                        ? (review.user.avatar.startsWith('http') ? review.user.avatar : `${import.meta.env.VITE_API_URL}${review.user.avatar}`)
                        : null 
            }));

        return formattedTestimonials;

    } catch (error) {
        console.error("❌ [TestimonialService] Erreur lors de la récupération :", error);
        return [];
    }
};