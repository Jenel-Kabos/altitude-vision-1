// src/services/eventService.js
import api from './api';

// --- DONNÉES DE SECOURS (FALLBACK) ---
const fallbackEvents = [
  {
    _id: "mock1",
    name: "Gala de Charité des Lumières (FALLBACK)",
    date: "2024-11-15",
    description: "Une soirée somptueuse en faveur de l'éducation. Design Art Déco. (Donnée de secours)",
    location: "Hôtel Radisson Blu, Brazzaville",
    category: "Gala",
    images: ["https://placehold.co/600x400/0A3D62/FFFFFF?text=Gala+Charite"],
    videos: [],
  },
];

/**
 * @description Récupère tous les événements
 */
export const getAllEvents = async () => {
  try {
    const response = await api.get('/events?sort=-date');
    return response.data.data.events;
  } catch (error) {
    console.error("❌ [eventService] Erreur lors du chargement des événements:", error);
    console.warn("⚠️ Utilisation des données de secours");
    return fallbackEvents;
  }
};

/**
 * @description Récupère un événement par son ID
 */
export const getEventById = async (eventId) => {
  try {
    const response = await api.get(`/events/${eventId}`);
    return response.data.data.event;
  } catch (error) {
    console.error(`❌ [eventService] Erreur lors du chargement de l'événement ${eventId}:`, error);
    throw error;
  }
};

/**
 * 🆕 @description Upload d'images pour un événement
 */
export const uploadEventImages = async (files) => {
  try {
    
    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append('images', file);
    });

    const response = await api.post('/events/upload-images', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data.data.images;
  } catch (error) {
    console.error("❌ [eventService] Erreur lors de l'upload des images:", error);
    
    if (error.response?.status === 400) {
      throw new Error(error.response.data?.message || 'Erreur lors de l\'upload des images');
    }
    
    if (error.response?.status === 401 || error.response?.status === 403) {
      throw new Error('Vous n\'êtes pas autorisé à uploader des images');
    }
    
    throw new Error('Erreur lors de l\'upload des images. Veuillez réessayer.');
  }
};

/**
 * 🆕 @description Upload de vidéos pour un événement
 */
export const uploadEventVideos = async (files) => {
  try {
    
    // Vérifier la limite de 3 vidéos
    if (files.length > 3) {
      throw new Error('Maximum 3 vidéos autorisées par événement');
    }

    // Vérifier la taille de chaque vidéo (100MB max)
    const maxSize = 100 * 1024 * 1024;
    for (const file of files) {
      if (file.size > maxSize) {
        throw new Error(`La vidéo "${file.name}" dépasse la taille maximale de 100MB`);
      }
    }
    
    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append('videos', file);
    });

    const response = await api.post('/events/upload-videos', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      // Timeout plus long pour les vidéos
      timeout: 300000, // 5 minutes
    });

    return response.data.data.videos;
  } catch (error) {
    console.error("❌ [eventService] Erreur lors de l'upload des vidéos:", error);
    
    if (error.response?.status === 400) {
      throw new Error(error.response.data?.message || 'Erreur lors de l\'upload des vidéos');
    }
    
    if (error.response?.status === 401 || error.response?.status === 403) {
      throw new Error('Vous n\'êtes pas autorisé à uploader des vidéos');
    }
    
    if (error.response?.status === 413) {
      throw new Error('Fichier trop volumineux. Maximum 100MB par vidéo.');
    }
    
    throw new Error(error.message || 'Erreur lors de l\'upload des vidéos. Veuillez réessayer.');
  }
};

/**
 * @description Crée un nouvel événement
 */
export const createEvent = async (eventData) => {
  try {
    const response = await api.post('/events', eventData);
    return response.data.data.event;
  } catch (error) {
    console.error("❌ [eventService] Erreur lors de la création de l'événement:", error);
    
    if (error.response?.status === 400) {
      const errorMessage = error.response.data?.errors 
        ? error.response.data.errors.join(', ')
        : error.response.data?.message || 'Données invalides';
      throw new Error(errorMessage);
    }
    
    if (error.response?.status === 401 || error.response?.status === 403) {
      throw new Error('Vous n\'êtes pas autorisé à créer un événement');
    }
    
    throw error;
  }
};

/**
 * @description Met à jour un événement existant
 */
export const updateEvent = async (eventId, eventData) => {
  try {
    const response = await api.put(`/events/${eventId}`, eventData);
    return response.data.data.event;
  } catch (error) {
    console.error(`❌ [eventService] Erreur lors de la mise à jour de l'événement ${eventId}:`, error);
    
    if (error.response?.status === 400) {
      const errorMessage = error.response.data?.errors 
        ? error.response.data.errors.join(', ')
        : error.response.data?.message || 'Données invalides';
      throw new Error(errorMessage);
    }
    
    if (error.response?.status === 404) {
      throw new Error('Événement introuvable');
    }
    
    if (error.response?.status === 401 || error.response?.status === 403) {
      throw new Error('Vous n\'êtes pas autorisé à modifier cet événement');
    }
    
    throw error;
  }
};

/**
 * @description Supprime un événement
 */
export const deleteEvent = async (eventId) => {
  try {
    await api.delete(`/events/${eventId}`);
  } catch (error) {
    console.error(`❌ [eventService] Erreur lors de la suppression de l'événement ${eventId}:`, error);
    
    if (error.response?.status === 404) {
      throw new Error('Événement introuvable');
    }
    
    if (error.response?.status === 401 || error.response?.status === 403) {
      throw new Error('Vous n\'êtes pas autorisé à supprimer cet événement');
    }
    
    throw error;
  }
};

/**
 * @description Récupère les événements avec pagination
 */
export const getEventsPaginated = async (page = 1, limit = 10) => {
  try {
    const response = await api.get(`/events?page=${page}&limit=${limit}&sort=-date`);
    return {
      events: response.data.data.events,
      pagination: response.data.pagination || {
        currentPage: page,
        totalPages: 1,
        totalEvents: response.data.data.events.length,
      },
    };
  } catch (error) {
    console.error("❌ [eventService] Erreur lors du chargement paginé:", error);
    return {
      events: fallbackEvents.slice((page - 1) * limit, page * limit),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(fallbackEvents.length / limit),
        totalEvents: fallbackEvents.length,
      },
    };
  }
};

/**
 * @description Recherche des événements par critères
 */
export const searchEvents = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    
    if (filters.search) params.append('search', filters.search);
    if (filters.category) params.append('category', filters.category);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    
    const response = await api.get(`/events?${params.toString()}&sort=-date`);
    return response.data.data.events;
  } catch (error) {
    console.error("❌ [eventService] Erreur lors de la recherche:", error);
    return fallbackEvents.filter(event => {
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        return (
          event.name.toLowerCase().includes(searchLower) ||
          event.description.toLowerCase().includes(searchLower) ||
          event.location.toLowerCase().includes(searchLower)
        );
      }
      if (filters.category && event.category !== filters.category) {
        return false;
      }
      return true;
    });
  }
};