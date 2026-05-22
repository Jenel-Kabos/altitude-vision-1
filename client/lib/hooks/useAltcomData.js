import { useState, useEffect } from "react";
// Assurez-vous que ces fonctions et le service 'api' sont définis dans votre projet
import { getAllServices } from "../services/serviceService";
import { getAllPortfolioItems } from "../services/portfolioService";
import api from "../services/api";

/**
 * Hook personnalisé pour récupérer toutes les données nécessaires à la page Altcom.
 * - Services Altcom
 * - Réalisations Portfolio (filtrées par Altcom)
 * - Avis clients (reviews bien notées, filtrées par Altcom)
 */
const useAltcomData = () => {
	const [services, setServices] = useState([]);
	// Le portfolio sera filtré plus tard pour ne montrer que les 6 derniers dans AltcomPage
	const [portfolio, setPortfolio] = useState([]);
	const [reviews, setReviews] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	// Utilitaire pour la gestion des retries avec backoff exponentiel
	const withRetry = async (fn, maxRetries = 3, delay = 1000) => {
		for (let i = 0; i < maxRetries; i++) {
			try {
				return await fn();
			} catch (error) {
				if (i === maxRetries - 1) throw error;
				await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
			}
		}
	};

	useEffect(() => {
		const fetchAltcomData = async () => {
			try {
				setLoading(true);
				setError(null);


				// Lancer les 3 requêtes en parallèle avec Promise.allSettled
				// pour gérer les échecs individuels sans bloquer les autres
				const promises = [
					// 1. Services Altcom uniquement (avec retry)
					withRetry(() => getAllServices('Altcom')),
					
					// 2. Portfolio Altcom uniquement (avec retry)
					withRetry(() => getAllPortfolioItems('Altcom')),
					
					// 3. Reviews bien notées (4-5 étoiles), triées par date (avec retry)
					withRetry(() => api.get('/reviews', {
						params: {
							'rating[gte]': 4,
							sort: '-createdAt',
							limit: 20, // Limiter pour ne pas charger trop de données
						}
					})),
				];

				const [servicesResult, portfolioResult, reviewsResult] = await Promise.allSettled(promises);

				// === TRAITEMENT DES SERVICES ===
				if (servicesResult.status === 'fulfilled') {
					setServices(servicesResult.value || []);
				} else {
					console.warn('⚠️ [useAltcomData] Impossible de charger les services:', servicesResult.reason);
					setServices([]);
				}

				// === TRAITEMENT DU PORTFOLIO ===
				if (portfolioResult.status === 'fulfilled') {
					// Le portfolio est chargé complet ici. AltcomPage le limitera à 6.
					setPortfolio(portfolioResult.value || []);
				} else {
					console.warn('⚠️ [useAltcomData] Impossible de charger le portfolio:', portfolioResult.reason);
					setPortfolio([]);
				}

				// === TRAITEMENT DES REVIEWS ===
				if (reviewsResult.status === 'fulfilled') {
					const allReviews = reviewsResult.value?.data?.data?.reviews || [];
					
					// Filtrer uniquement les reviews liées à des éléments Altcom
					const altcomReviews = allReviews.filter(review => {
						// On suppose que le champ 'pole' est disponible dans portfolioItem.
						return review.portfolioItem && review.portfolioItem.pole === 'Altcom';
					});
					
					setReviews(altcomReviews);
				} else {
					console.warn('⚠️ [useAltcomData] Impossible de charger les reviews:', reviewsResult.reason);
					setReviews([]);
				}

				// Si toutes les requêtes ont échoué, déclencher une erreur globale
				const allFailed = 
					servicesResult.status === 'rejected' && 
					portfolioResult.status === 'rejected' && 
					reviewsResult.status === 'rejected';

				if (allFailed) {
					// Lancer une erreur pour être capturée par le catch(err) si au moins une tentative de retry a eu lieu
					throw new Error('Impossible de charger les données Altcom. Vérifiez votre connexion.');
				}

			} catch (err) {
				console.error("❌ [useAltcomData] Erreur critique:", err);
				// Utiliser l'objet Error si disponible
				setError(err.message || "Une erreur inconnue est survenue lors du chargement des données Altcom.");
			} finally {
				setLoading(false);
			}
		};

		fetchAltcomData();
	}, []); // Exécuter une seule fois au montage du composant

	return { 
		services, 
		portfolio, 
		reviews, 
		loading, 
		error 
	};
};

export default useAltcomData;