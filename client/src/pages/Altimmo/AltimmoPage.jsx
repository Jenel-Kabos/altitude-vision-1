import React, { useState, useEffect } from 'react';
import axios from 'axios';
import PropertyCard from '../../components/PropertyCard';

const AltimmoPage = () => {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        setLoading(true);
        // Note: l'URL est complète ici, mais nous avons configuré une baseURL dans services/api.js
        const { data } = await axios.get('http://localhost:5000/api/properties');
        setProperties(data);
        setLoading(false);
      } catch (err) {
        setError('Impossible de charger les biens immobiliers.');
        setLoading(false);
        console.error(err);
      }
    };

    fetchProperties();
  }, []); // Le tableau vide signifie que cet effet ne s'exécute qu'une fois au montage

  if (loading) return <p className="text-center mt-8">Chargement...</p>;
  if (error) return <p className="text-center mt-8 text-red-500">{error}</p>;

  return (
    <div className="container mx-auto px-6 py-12">
      <h1 className="text-4xl font-bold text-primary mb-8">Nos Biens Immobiliers</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {properties.map((property) => (
          <PropertyCard key={property._id} property={property} />
        ))}
      </div>
    </div>
  );
};

export default AltimmoPage;