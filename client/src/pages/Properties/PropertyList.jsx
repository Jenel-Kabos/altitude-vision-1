import React, { useEffect, useState } from 'react';
import { getAllProperties } from '../../services/propertyService';
import Spinner from '../../components/layout/Spinner.jsx';
import PropertyCard from './PropertyCard.jsx';

const PropertyList = () => {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        setLoading(true);
        const data = await getAllProperties();
        setProperties(data);
        setError('');
      } catch (err) {
        console.error(err);
        setError('Impossible de charger les biens.');
      } finally {
        setLoading(false);
      }
    };
    fetchProperties();
  }, []);

  if (loading) return <Spinner />;

  if (error) return <div className="text-center text-red-500 py-10">{error}</div>;

  if (!properties.length) return <div className="text-center py-10 text-gray-600">Aucun bien disponible.</div>;

  return (
    <div className="container mx-auto px-4 py-16">
      <h2 className="text-3xl font-bold text-center mb-10">Nos Biens Disponibles</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
        {properties.map(p => <PropertyCard key={p._id} property={p} />)}
      </div>
    </div>
  );
};

export default PropertyList;
