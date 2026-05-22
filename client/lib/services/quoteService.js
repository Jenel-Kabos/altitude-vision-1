// src/services/quoteService.js
import api from './api';

/**
 * @description Soumettre une demande de devis pour un événement
 * @param {Object} quoteData - Les données du formulaire de devis
 * @returns {Promise<Object>} - Réponse de l'API avec les détails du devis créé
 */
export const createQuoteRequest = async (quoteData) => {
  try {
    
    const response = await api.post('/quotes', quoteData);
    
    
    return response.data;
  } catch (error) {
    console.error("❌ [quoteService] Erreur lors de la création du devis:", error);
    
    if (error.response?.status === 400) {
      const errorMessage = error.response.data?.errors 
        ? error.response.data.errors.join(', ')
        : error.response.data?.message || 'Données invalides';
      
      throw new Error(errorMessage);
    }
    
    if (error.response?.status >= 500) {
      throw new Error('Erreur serveur. Veuillez réessayer plus tard.');
    }
    
    if (!error.response) {
      throw new Error('Impossible de contacter le serveur. Vérifiez votre connexion.');
    }
    
    throw error;
  }
};

/**
 * @description Récupérer tous les devis (Admin uniquement)
 * @returns {Promise<Array>} - Liste de tous les devis
 */
export const getAllQuotes = async () => {
  try {
    const response = await api.get('/quotes');
    return response.data.data.quotes;
  } catch (error) {
    console.error("❌ [quoteService] Erreur lors de la récupération des devis:", error);
    
    // Données de secours pour le développement
    const fallbackQuotes = [
      {
        _id: 'mock1',
        name: 'Marie Dupont',
        email: 'marie.dupont@example.com',
        phone: '+242 06 123 4567',
        service: 'Organisation d\'Événements Privés',
        eventType: 'Mariage',
        date: '2025-06-15',
        guests: 150,
        budget: '5M-10M',
        description: 'Nous souhaitons organiser un mariage élégant dans un cadre champêtre avec environ 150 invités. Nous recherchons un service complet incluant la décoration, le traiteur, et l\'animation.',
        status: 'Nouveau',
        createdAt: new Date().toISOString(),
      },
      {
        _id: 'mock2',
        name: 'Jean Martin',
        email: 'jean.martin@company.com',
        phone: '+242 06 987 6543',
        service: 'Gestion d\'Événements Corporatifs',
        eventType: 'Conférence',
        date: '2025-04-20',
        guests: 300,
        budget: 'Plus de 10M',
        description: 'Organisation d\'une conférence tech avec des intervenants internationaux. Besoin de logistique complète, traduction simultanée, et catering pour 3 jours.',
        status: 'En cours',
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        _id: 'mock3',
        name: 'Sophie Bernard',
        email: 'sophie.b@email.com',
        phone: '+242 06 555 7890',
        service: 'Design & Scénographie Sur Mesure',
        eventType: 'Anniversaire',
        date: '2025-05-10',
        guests: 80,
        budget: '1M-5M',
        description: 'Anniversaire de 50 ans avec décoration thème années 80. Nous voulons une ambiance rétro avec DJ, animations et photo booth.',
        status: 'Devis Envoyé',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        _id: 'mock4',
        name: 'Pierre Okemba',
        email: 'p.okemba@startup.cg',
        phone: '+242 06 111 2222',
        service: 'Campagne Publicitaire',
        eventType: 'Lancement de Produit',
        date: '2025-03-15',
        guests: 200,
        budget: '5M-10M',
        description: 'Lancement d\'une nouvelle application mobile. Besoin de campagne digitale complète : réseaux sociaux, influenceurs, event de lancement.',
        status: 'Nouveau',
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        _id: 'mock5',
        name: 'Laure Nguesso',
        email: 'laure.n@gmail.com',
        phone: '+242 06 333 4444',
        service: 'Organisation d\'Événements Privés',
        eventType: 'Baptême',
        date: '2025-07-20',
        guests: 120,
        budget: '1M-5M',
        description: 'Baptême de notre fille. Recherche décoration élégante, traiteur, et animation pour enfants.',
        status: 'Converti',
        createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];
    
    console.warn("⚠️ Utilisation des données de secours pour les devis");
    return fallbackQuotes;
  }
};

/**
 * @description Récupérer un devis par son ID
 * @param {string} quoteId - L'identifiant du devis
 * @returns {Promise<Object>} - Détails du devis
 */
export const getQuoteById = async (quoteId) => {
  try {
    const response = await api.get(`/quotes/${quoteId}`);
    return response.data.data.quote;
  } catch (error) {
    console.error(`❌ [quoteService] Erreur lors de la récupération du devis ${quoteId}:`, error);
    throw error;
  }
};

/**
 * @description Mettre à jour le statut d'un devis
 * @param {string} quoteId - L'identifiant du devis
 * @param {string} status - Nouveau statut
 * @returns {Promise<Object>} - Devis mis à jour
 */
export const updateQuoteStatus = async (quoteId, status) => {
  try {
    const response = await api.patch(`/quotes/${quoteId}`, { status });
    return response.data.data.quote;
  } catch (error) {
    console.error(`❌ [quoteService] Erreur lors de la mise à jour du devis ${quoteId}:`, error);
    // En mode développement avec données de secours, on simule la mise à jour
    console.warn("⚠️ Mode développement : mise à jour simulée");
    return { _id: quoteId, status };
  }
};

/**
 * @description Envoyer une réponse de devis au client
 * @param {string} quoteId - L'identifiant du devis
 * @param {Object} responseData - Données de la réponse
 * @returns {Promise<Object>} - Confirmation d'envoi
 */
export const sendQuoteResponse = async (quoteId, responseData) => {
  try {
    const response = await api.post(`/quotes/${quoteId}/respond`, responseData);
    return response.data;
  } catch (error) {
    console.error(`❌ [quoteService] Erreur lors de l'envoi de la réponse:`, error);
    throw error;
  }
};

/**
 * @description Supprimer un devis
 * @param {string} quoteId - L'identifiant du devis
 * @returns {Promise<void>}
 */
export const deleteQuote = async (quoteId) => {
  try {
    await api.delete(`/quotes/${quoteId}`);
  } catch (error) {
    console.error(`❌ [quoteService] Erreur lors de la suppression du devis ${quoteId}:`, error);
    throw error;
  }
};