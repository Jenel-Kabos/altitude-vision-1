import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Spinner from '../../components/layout/Spinner';

const AdminProjectList = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { userInfo } = useAuth();
  const navigate = useNavigate();

  // Fonction pour récupérer tous les projets
  const fetchProjects = async () => {
    try {
      // Pas besoin de token pour cette route GET publique
      const { data } = await axios.get('http://localhost:5000/api/projects');
      setProjects(data);
    } catch (err) {
      setError('Impossible de charger la liste des projets.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Charger les données au premier rendu
  useEffect(() => {
    fetchProjects();
  }, []);

  // Gestionnaire pour supprimer un projet
  const deleteHandler = async (id) => {
    if (window.confirm('Voulez-vous vraiment supprimer ce projet ?')) {
      try {
        const config = {
          headers: {
            Authorization: `Bearer ${userInfo.token}`,
          },
        };
        // Assurez-vous d'avoir une route DELETE /api/projects/:id sur votre backend
        await axios.delete(`http://localhost:5000/api/projects/${id}`, config);
        // Recharger la liste des projets
        fetchProjects();
      } catch (err) {
        alert('La suppression du projet a échoué.');
      }
    }
  };

  if (loading) return <Spinner />;
  if (error) return <p className="text-center text-red-500 py-10">{error}</p>;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-primary">Gestion du Portfolio (Altcom)</h1>
        {/* Ce bouton redirigera vers un futur formulaire de création */}
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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {projects.map((project) => (
              <tr key={project._id}>
                <td className="px-6 py-4 whitespace-nowrap">
                    <img src={project.imageUrl} alt={project.title} className="w-16 h-10 object-cover rounded"/>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{project.title}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{project.category}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <span className="font-bold">★ {project.rating.toFixed(1)}</span> ({project.numReviews})
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-4">
                  <button 
                    onClick={() => navigate(`/admin/projets/${project._id}/edit`)} 
                    className="text-blue-600 hover:text-blue-900"
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