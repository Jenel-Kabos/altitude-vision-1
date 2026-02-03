import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import Spinner from '../../components/layout/Spinner';

const AdminServiceList = () => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const fetchServices = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/services');
      setServices(data);
    } catch (err) {
      setError('Impossible de charger la liste des services.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const deleteHandler = async (id) => {
    if (window.confirm('Voulez-vous vraiment supprimer ce service ?')) {
      try {
        await api.delete(`/services/${id}`);
        // Rafraîchir la liste après suppression
        fetchServices();
      } catch (err) {
        alert('La suppression du service a échoué.');
        console.error(err);
      }
    }
  };

  if (loading) return <Spinner />;
  if (error) return <p className="text-center text-red-500 py-10">{error}</p>;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-primary">Gestion des Services</h1>
        <button 
          onClick={() => navigate('/admin/services/creer')} 
          className="bg-primary text-white font-bold py-2 px-4 rounded hover:bg-blue-800 transition"
        >
          + Ajouter un service
        </button>
      </div>
      <div className="bg-white shadow-md rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom du Service</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Catégorie</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prix de base</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {services.map((service) => (
              <tr key={service._id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{service.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{service.category}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(service.basePrice)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right space-x-4">
                  <button 
                    onClick={() => navigate(`/admin/services/${service._id}/edit`)} 
                    className="text-indigo-600 hover:text-indigo-900"
                  >
                    Modifier
                  </button>
                  <button onClick={() => deleteHandler(service._id)} className="text-red-600 hover:text-red-900">
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminServiceList;