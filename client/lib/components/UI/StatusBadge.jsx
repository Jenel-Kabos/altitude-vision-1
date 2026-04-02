import React from 'react';

/**
 * A reusable component to display status labels with appropriate colors.
 * @param {{ status: string }} props - The props object.
 * @param {string} props.status - The status string to display.
 */
const StatusBadge = ({ status }) => {
  const statusClasses = {
    // Statuts de propriété
    'disponible': 'bg-blue-100 text-blue-800',
    'en transaction': 'bg-yellow-100 text-yellow-800',
    'vendu': 'bg-green-100 text-green-800',
    'loué': 'bg-indigo-100 text-indigo-800',
    // Statuts de paiement
    'en attente': 'bg-orange-100 text-orange-800',
    'payé': 'bg-emerald-100 text-emerald-800',
    // Default
    'default': 'bg-gray-100 text-gray-800',
  };

  const statusKey = status?.toLowerCase() || 'default';
  
  return (
    <span className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap ${statusClasses[statusKey] || statusClasses['default']}`}>
      {status}
    </span>
  );
};

export default StatusBadge;