import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

/**
 * Affiche une carte de présentation pour un bien immobilier.
 * @param {object} props - Les props du composant.
 * @param {object} props.property - L'objet contenant les informations du bien.
 */
const PropertyCard = ({ property }) => {
  // Formatter le prix au format de la monnaie locale (Franc CFA)
  const formattedPrice = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XAF',
    maximumFractionDigits: 0, // Ne pas afficher les centimes
  }).format(property.price);

  return (
    // Animation d'apparition douce lors du chargement de la carte
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      whileHover={{ y: -5 }} // Léger soulèvement au survol
    >
      {/* La carte entière est un lien vers la page de détails du bien */}
      <Link to={`/altimmo/${property._id}`} className="block group">
        <div className="bg-white rounded-lg shadow-md overflow-hidden h-full flex flex-col">
          <div className="relative">
            {/* Image du bien */}
            <img
              // Construit l'URL complète vers l'image sur le serveur backend
              src={`http://localhost:5000/${property.images[0]}`}
              alt={property.title}
              className="w-full h-56 object-cover group-hover:scale-105 transition-transform duration-300 ease-in-out"
            />
            {/* Badge de statut (Vente/Location) */}
            <span
              className={`absolute top-4 left-4 px-3 py-1 text-sm font-semibold text-white rounded-full ${
                property.status === 'Vente' ? 'bg-red-600' : 'bg-blue-600'
              }`}
            >
              À {property.status}
            </span>
          </div>

          {/* Contenu textuel de la carte */}
          <div className="p-6 flex flex-col flex-grow">
            <h3 className="text-xl font-bold text-primary mb-2 truncate">
              {property.title}
            </h3>
            <p className="text-gray-600 text-sm mb-4">
              {property.address}, {property.district}
            </p>
            <p className="text-2xl font-semibold text-secondary mt-auto">
              {formattedPrice}
            </p>
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

export default PropertyCard;