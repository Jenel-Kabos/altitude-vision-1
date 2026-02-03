import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import Spinner from '../components/layout/Spinner';
import StatusBadge from '../components/ui/StatusBadge';

const OwnerDashboard = () => {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const backendUrl = import.meta.env.VITE_API_URL.replace('/api', '') || 'http://localhost:5000';

  const fetchMyProperties = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/properties/my-properties');
      setProperties(data);
    } catch (err) {
      setError('Impossible de charger vos propriétés. Veuillez réessayer.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMyProperties();
  }, [fetchMyProperties]);

  if (loading) return <Spinner />;
  if (error) return <div className="text-center p-10 text-red-500 bg-red-100 m-4 rounded">{error}</div>;

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="container mx-auto p-4 md:p-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-6">Mon Espace Propriétaire</h1>
        
        {properties.length === 0 ? (
          <div className="text-center bg-white p-10 rounded-lg shadow">
            <p className="text-gray-600 mb-4">Vous n'avez aucune propriété enregistrée pour le moment.</p>
            <Link to="/soumettre-propriete" className="bg-primary text-white font-bold py-2 px-4 rounded hover:bg-blue-800 transition">
                Ajouter ma première propriété
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {properties.map(prop => (
              <div key={prop._id} className="bg-white rounded-lg shadow-md overflow-hidden transition-transform hover:-translate-y-1">
                <Link to={`/propriete/${prop._id}`}>
                  <img src={`${backendUrl}${prop.images[0]}`} alt={`Vue de ${prop.title}`} className="w-full h-48 object-cover" />
                </Link>
                <div className="p-5">
                  <div className="flex justify-between items-start mb-2">
                    <h2 className="text-xl font-bold text-gray-900 pr-2">{prop.title}</h2>
                    <StatusBadge status={prop.status} />
                  </div>
                  <p className="text-gray-600 mb-4 truncate">{prop.address}</p>

                  {(prop.status === 'vendu' || prop.status === 'loué') && prop.ownerPayoutAmount && (
                    <div className="bg-gray-100 p-3 rounded-md mt-4">
                      <h3 className="font-semibold text-gray-700 mb-2">Détails de la Transaction</h3>
                      <div className="flex justify-between text-sm">
                        <span>Versement à recevoir:</span>
                        <span className="font-bold text-green-600">{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF' }).format(prop.ownerPayoutAmount)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm mt-1">
                        <span>Statut du paiement:</span>
                        <StatusBadge status={prop.payoutStatus} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OwnerDashboard;