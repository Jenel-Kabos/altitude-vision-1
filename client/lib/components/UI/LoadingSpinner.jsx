import React from 'react';

/**
 * Un composant simple qui affiche un indicateur de chargement centré.
 * Parfait pour montrer à l'utilisateur qu'une action est en cours (ex: appel API).
 */
export default function LoadingSpinner() {
  return (
    <div className="flex justify-center items-center py-20">
      <div 
        className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"
        role="status" // Rôle ARIA pour l'accessibilité
      >
        <span className="sr-only">Chargement...</span> {/* Texte pour les lecteurs d'écran */}
      </div>
    </div>
  );
}