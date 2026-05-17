import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { FaPlus, FaPencilAlt, FaTrash } from 'react-icons/fa';
import api from '../../services/api';
import Spinner from '../../components/layout/Spinner';

const AdminEventList = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/events'); // Endpoint GET standard
      setEvents(data);
      setError(null);
    } catch (err) {
      setError('Erreur lors du chargement des événements.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleDelete = async (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cet événement ?')) {
      try {
        await api.delete(`/events/${id}`);
        fetchEvents(); // Recharger la liste après suppression
      } catch (err) {
        setError('La suppression a échoué.');
        console.error(err);
      }
    }
  };

  if (loading) return <Spinner />;
  if (error) return <p className="text-center mt-8 text-red-500">{error}</p>;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Gérer les Événements</h1>
        <Link
          to="/admin/evenements/creer"
          className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-blue-800 transition duration-300 flex items-center"
        >
          <FaPlus className="mr-2" /> Créer un Événement
        </Link>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Titre</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {events.map((event) => (
              <tr key={event._id}>
                <td className="px-6 py-4 whitespace-nowrap">{event.title}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {new Date(event.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric'})}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {event.isPublished ? (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Publié</span>
                  ) : (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">Brouillon</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <Link to={`/admin/evenements/${event._id}/edit`} className="text-indigo-600 hover:text-indigo-900 mr-4" title="Modifier">
                    <FaPencilAlt />
                  </Link>
                  <button onClick={() => handleDelete(event._id)} className="text-red-600 hover:text-red-900" title="Supprimer">
                    <FaTrash />
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

export default AdminEventList;