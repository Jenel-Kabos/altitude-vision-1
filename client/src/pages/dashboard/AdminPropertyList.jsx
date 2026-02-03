import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import Spinner from '../../components/layout/Spinner';
import { FaCheck, FaTimes, FaPencilAlt, FaTrash, FaPlus, FaHome } from 'react-icons/fa';

// Sous-composant pour les notifications
const Notification = ({ message, type }) => {
  const baseClasses = 'p-3 rounded mb-4';
  const typeClasses = {
    error: 'bg-red-100 text-red-700',
    success: 'bg-green-100 text-green-700',
  };
  return <div className={`${baseClasses} ${typeClasses[type]}`}>{message}</div>;
};

const AdminPropertyList = () => {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState('');

  const fetchProperties = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/properties');
      setProperties(data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors du chargement des biens.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  const showTemporaryNotification = (message) => {
    setNotification(message);
    setTimeout(() => setNotification(''), 3000); // La notification disparaît après 3s
  };

  const approveHandler = async (id) => {
    try {
      await api.put(`/properties/${id}/approve`);
      showTemporaryNotification('✅ Le bien a été publié avec succès.');
      fetchProperties(); // Rafraîchir la liste pour refléter le changement de statut
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de l’approbation.');
    }
  };

  const deleteHandler = async (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce bien ?')) {
      try {
        await api.delete(`/properties/${id}`);
        showTemporaryNotification('🗑️ Le bien a été supprimé.');
        fetchProperties(); // Rafraîchir la liste
      } catch (err) {
        setError(err.response?.data?.message || 'Erreur lors de la suppression.');
      }
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Gérer les Biens Immobiliers</h1>
        <div className="flex items-center space-x-4">
          <Link to="/" className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition duration-300 flex items-center">
            <FaHome className="mr-2" /> Accueil Site
          </Link>
          <Link to="/soumettre-propriete" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition duration-300 flex items-center">
            <FaPlus className="mr-2" /> Ajouter un Bien
          </Link>
        </div>
      </div>

      {error && <Notification message={error} type="error" />}
      {notification && <Notification message={notification} type="success" />}

      <div className="bg-white shadow-md rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Titre</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Utilisateur</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {properties.length > 0 ? (
              properties.map((property) => (
                <tr key={property._id}>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{property.title}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">{property.user?.name || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {property.isApproved ? (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        <FaCheck className="inline mr-1" /> Approuvé
                      </span>
                    ) : (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                        <FaTimes className="inline mr-1" /> En attente
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {!property.isApproved && (
                      <button
                        onClick={() => approveHandler(property._id)}
                        className="bg-green-500 text-white px-3 py-1 rounded-md hover:bg-green-600 mr-2"
                      >
                        Approuver
                      </button>
                    )}
                    <Link
                      to={`/propriete/${property._id}/edit`}
                      className="text-indigo-600 hover:text-indigo-900 mr-4 inline-block align-middle"
                      title="Modifier"
                    >
                      <FaPencilAlt />
                    </Link>
                    <button
                      onClick={() => deleteHandler(property._id)}
                      className="text-red-600 hover:text-red-900 inline-block align-middle"
                      title="Supprimer"
                    >
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="text-center text-gray-500 py-4">
                  Aucun bien trouvé.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminPropertyList;