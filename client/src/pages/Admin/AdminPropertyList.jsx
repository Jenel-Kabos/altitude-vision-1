import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Spinner from '../../components/layout/Spinner';

const AdminPropertyList = () => {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { userInfo } = useAuth();

  // Fonction pour récupérer toutes les propriétés (y compris non publiées)
  const fetchProperties = async () => {
    try {
      // Configuration de la requête avec le token d'authentification
      const config = {
        headers: {
          Authorization: `Bearer ${userInfo.token}`,
        },
      };
      // Appel à l'endpoint réservé aux administrateurs
      const { data } = await axios.get('http://localhost:5000/api/properties/admin/all', config);
      setProperties(data);
    } catch (err) {
      setError('Impossible de charger la liste des biens.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Charger les données au premier rendu du composant
  useEffect(() => {
    if (userInfo && userInfo.token) {
      fetchProperties();
    }
  }, [userInfo]);

  // Gestionnaire pour approuver une propriété
  const approveHandler = async (id) => {
    if (window.confirm('Voulez-vous vraiment approuver et publier ce bien ?')) {
      try {
        const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };
        await axios.put(`http://localhost:5000/api/properties/${id}/approve`, {}, config);
        // Recharger la liste pour voir le changement de statut
        fetchProperties(); 
      } catch (err) {
        alert('L\'approbation a échoué.');
      }
    }
  };

  // Gestionnaire pour supprimer une propriété
  const deleteHandler = async (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce bien ? Cette action est irréversible.')) {
      try {
        const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };
        await axios.delete(`http://localhost:5000/api/properties/${id}`, config);
        // Recharger la liste
        fetchProperties();
      } catch (err) {
        alert('La suppression a échoué.');
      }
    }
  };
  
  // Rendu conditionnel
  if (loading) return <Spinner />;
  if (error) return <p className="text-center text-red-500 py-10">{error}</p>;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-primary">Gestion des Biens Immobiliers</h1>
        <Link to="/soumettre-propriete" className="bg-primary text-white font-bold py-2 px-4 rounded hover:bg-blue-800 transition">
          + Ajouter un bien
        </Link>
      </div>
      <div className="bg-white shadow-md rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Titre</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Propriétaire</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {properties.map((prop) => (
              <tr key={prop._id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{prop.title}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{prop.owner?.name || 'Utilisateur inconnu'}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {prop.isPublished ? (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Publié</span>
                  ) : (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">En attente</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(prop.createdAt).toLocaleDateString('fr-FR')}
                </td>

                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-4">
                  {!prop.isPublished && (
                    <button onClick={() => approveHandler(prop._id)} className="text-green-600 hover:text-green-900">Approuver</button>
                  )}
                  <Link to={`/altimmo/${prop._id}`} className="text-blue-600 hover:text-blue-900">Voir</Link>
                  <button onClick={() => deleteHandler(prop._id)} className="text-red-600 hover:text-red-900">Supprimer</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminPropertyList;