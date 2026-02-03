import React, { useState, useEffect } from 'react';
import api from '../../services/api'; // Votre instance Axios pré-configurée
import PropertyCard from '../../components/Properties/PropertyCard.jsx';
import LoadingSpinner from '../../components/UI/LoadingSpinner.jsx';

export default function PropertiesPage() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        setLoading(true);
        // Appel à l'endpoint GET /api/properties
        const response = await api.get('/properties');
        setProperties(response.data);
        setError(null);
      } catch (err) {
        console.error("Erreur lors de la récupération des propriétés:", err);
        setError("Impossible de charger les biens. Veuillez réessayer plus tard.");
      } finally {
        setLoading(false);
      }
    };

    fetchProperties();
  }, []); // Le tableau vide signifie que cet effet ne s'exécute qu'une fois, au montage

  // Affiche un indicateur de chargement
  if (loading) {
    return <LoadingSpinner />;
  }

  // Affiche un message d'erreur en cas de problème
  if (error) {
    return <div className="text-center text-red-500">{error}</div>;
  }

  return (
    <div className="container mx-auto px-4">
      <h1 className="text-3xl font-bold mb-8 text-center">Nos Biens Immobiliers</h1>
      
      {/* Grille responsive pour afficher les cartes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {properties.length > 0 ? (
          properties.map((property) => (
            <PropertyCard key={property._id} property={property} />
          ))
        ) : (
          <p className="col-span-full text-center">Aucun bien disponible pour le moment.</p>
        )}
      </div>
    </div>
  );
}