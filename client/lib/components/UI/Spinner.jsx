'use client';

import React from 'react';

const SIZE_MAP = {
  xs: 'w-4 h-4 border-2',
  sm: 'w-6 h-6 border-2',
  md: 'w-10 h-10 border-4',
  lg: 'w-16 h-16 border-[6px]',
};

/**
 * Spinner unifié — remplace LoadingSpinner + layout/Spinner.
 * @param {'xs'|'sm'|'md'|'lg'} size
 * @param {boolean} centered  Ajoute un wrapper flex centré avec padding
 * @param {string}  label     Texte sr-only (accessibilité)
 * @param {string}  className Classes supplémentaires sur le wrapper
 */
const Spinner = ({ size = 'md', centered = false, label = 'Chargement…', className = '' }) => {
  const wheel = (
    <div
      role="status"
      aria-label={label}
      className={`${SIZE_MAP[size]} rounded-full border-gray-200 border-t-[var(--gold)] animate-spin flex-shrink-0`}
    >
      <span className="sr-only">{label}</span>
    </div>
  );

  if (!centered) return wheel;

  return (
    <div className={`flex justify-center items-center py-20 ${className}`}>
      {wheel}
    </div>
  );
};

export default React.memo(Spinner);
