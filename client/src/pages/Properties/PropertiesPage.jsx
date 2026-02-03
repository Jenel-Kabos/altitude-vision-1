import React, { useState, useEffect } from 'react';
import PropertyCard from '../../components/Properties/PropertyCard.jsx';
import LoadingSpinner from '../../components/UI/LoadingSpinner.jsx';
import { fetchProperties } from '../../services/fetchProperties';

export default function PropertiesPage() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        const allProperties = await fetchProperties(); 
        setProperties(allProperties);
        setError(null);
      } catch (err) {
        setError("Impossible de charger les biens. Veuillez réessayer plus tard.");
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-center text-red-500 py-10">{error}</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 text-center">Nos Biens Immobiliers</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {properties.length > 0 ? (
          properties.map(property => <PropertyCard key={property._id} property={property} />)
        ) : (
          <p className="col-span-full text-center text-gray-500">Aucun bien disponible pour le moment.</p>
        )}
      </div>
    </div>
  );
}
