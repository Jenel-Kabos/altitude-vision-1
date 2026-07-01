import React from 'react';

/**
 * État vide générique — remplace les messages inline dans chaque page.
 * @param {React.ReactNode} icon        Icône SVG ou emoji
 * @param {string}          title       Titre principal
 * @param {string}          description Texte secondaire
 * @param {React.ReactNode} action      CTA optionnel (bouton, lien…)
 * @param {string}          className   Classes supplémentaires
 */
const EmptyState = ({ icon, title, description, action, className = '' }) => (
  <div
    role="status"
    aria-live="polite"
    className={`flex flex-col items-center justify-center py-20 px-6 text-center ${className}`}
  >
    {icon && (
      <div className="mb-5 text-5xl text-gray-300" aria-hidden="true">
        {icon}
      </div>
    )}
    <h3 className="text-lg font-semibold text-gray-700 mb-2">{title}</h3>
    {description && (
      <p className="text-sm text-gray-500 max-w-sm leading-relaxed mb-6">{description}</p>
    )}
    {action && <div>{action}</div>}
  </div>
);

export default EmptyState;
