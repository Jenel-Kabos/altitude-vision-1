// src/hooks/useUnreadCount.js

import { useState, useEffect } from 'react';
// Importez votre librairie de requêtes HTTP (ex: axios)
import axios from 'axios'; 

// Fréquence de rafraîchissement en millisecondes (ex: 30 secondes)
const REFRESH_INTERVAL = 30000; 

/**
 * Hook personnalisé pour récupérer le nombre de messages non lus.
 * @returns {number} Le nombre de messages non lus.
 */
const useUnreadCount = () => {
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        // --- Fonction principale de récupération des données ---
        const fetchUnreadCount = async () => {
            try {
                // 🛑 REMPLACEZ CECI par l'URL de votre endpoint API réel.
                // Assurez-vous que cet endpoint retourne un objet avec le compte,
                // par exemple : { count: 5 }
                const response = await axios.get('/api/messages/unread/count');
                
                // 🛑 Ajustez le chemin si nécessaire (ex: response.data.total)
                const count = response.data.count || 0; 
                setUnreadCount(count);

            } catch (error) {
                // Si l'appel échoue (ex: utilisateur non authentifié ou erreur serveur),
                // on affiche l'erreur et on réinitialise le compte à 0.
                console.error("Erreur lors de la récupération du compte non lu :", error);
                setUnreadCount(0);
            }
        };
        // ----------------------------------------------------

        // 1. Appel initial immédiat
        fetchUnreadCount();

        // 2. Mise en place de l'intervalle de rafraîchissement
        const intervalId = setInterval(fetchUnreadCount, REFRESH_INTERVAL); 

        // 3. Fonction de nettoyage : s'exécute lorsque le composant est démonté
        return () => clearInterval(intervalId);
    }, []); // Le tableau vide garantit que l'effet s'exécute une seule fois au montage.

    return unreadCount;
};

export default useUnreadCount;