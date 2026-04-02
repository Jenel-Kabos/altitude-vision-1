// Fichier : ../messaging/UnreadMessagesBadge.jsx

import React from 'react';

// Le composant reçoit maintenant le compte non lu via les props
const UnreadMessagesBadge = ({ count, className }) => {
    // 🚨 Logique clé : Le composant ne rend rien si count est 0 ou non défini
    if (!count || count <= 0) {
        return null;
    }

    return (
        <span 
            className={`bg-red-500 text-white text-xs font-bold 
                        px-2 py-0.5 rounded-full ring-2 ring-white z-50
                        ${className || ''}`} 
        >
            {/* Affichage dynamique du nombre réel de messages non lus */}
            {count}
        </span>
    );
};

export default UnreadMessagesBadge;