import React from 'react';

/**
 * A simple, reusable loading spinner component.
 * @param {object} props - The component props.
 * @param {string} [props.size='w-16 h-16'] - TailwindCSS size classes for the spinner.
 * @param {string} [props.className] - Additional classes for the container.
 */
const Spinner = ({ size = 'w-16 h-16', className = '' }) => {
  return (
    <div className={`flex justify-center items-center p-10 ${className}`}>
      <div
        className={`
          border-8 
          border-gray-200 
          border-t-primary 
          rounded-full 
          animate-spin
          ${size}
        `}
        role="status"
        aria-label="Chargement en cours"
      >
        <span className="sr-only">Chargement...</span>
      </div>
    </div>
  );
};

export default React.memo(Spinner);