import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import Spinner from '../../components/layout/Spinner';

const AdminProjectList = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const backendUrl = import.meta.env.VITE_API_URL.replace('/api', '') || 'http://localhost:5000';

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/projects');
      setProjects(data);
    } catch (err) {
      setError('Impossible de charger la liste des projets.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const deleteHandler = async (id) => {
    if (window.confirm('Voulez-vous vraiment supprimer ce projet ?')) {
      try {
        await api.delete(`/projects/${id}`);
        fetchProjects();
      } catch (err) {
        alert('La suppression du projet a échoué.');
        console.error(err);
      }
    }
  };

  if (loading) return <Spinner />;
  if (error) return <p className="text-center text-red-500 py-10">{error}</p>;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-primary">Gestion du Portfolio (Altcom)</h1>
        <button 
          onClick={() => navigate('/admin/projets/creer')} 
          className="bg-primary text-white font-bold py-2 px-4 rounded hover:bg-blue-800 transition"
        >
          + Ajouter un projet
        </button>
      </div>
      <div className="bg-white shadow-md rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Image</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Titre</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Catégorie</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avis</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {projects.map((project) => (
              <tr key={project._id}>
                <td className="px-6 py-4 whitespace-nowrap">
                    <img src={`${backendUrl}${project.imageUrl}`} alt={project.title} className="w-16 h-10 object-cover rounded"/>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{project.title}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{project.category}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <span className="font-bold">★ {project.rating.toFixed(1)}</span> ({project.numReviews})
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right space-x-4">
                  <button 
                    onClick={() => navigate(`/admin/projets/${project._id}/edit`)} 
                    className="text-indigo-600 hover:text-indigo-900"
                  >
                    Modifier
                  </button>
                  <button onClick={() => deleteHandler(project._id)} className="text-red-600 hover:text-red-900">
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

export default AdminProjectList;