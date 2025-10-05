import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import Spinner from '../../components/layout/Spinner';

// --- Composant interne pour la carte d'un projet ---
const ProjectCard = ({ project, onReviewClick }) => (
  <div className="bg-white rounded-lg shadow-lg overflow-hidden flex flex-col">
    <img src={project.imageUrl || 'https://via.placeholder.com/400x250'} alt={project.title} className="w-full h-56 object-cover" />
    <div className="p-6 flex flex-col flex-grow">
      <span className="inline-block self-start bg-blue-100 text-primary text-sm font-semibold px-3 py-1 rounded-full mb-3">{project.category}</span>
      <h3 className="text-2xl font-bold text-primary mb-2">{project.title}</h3>
      <p className="text-gray-600 mb-4 flex-grow">{project.description}</p>
      <div className="flex items-center justify-between mt-auto">
        <div className="flex items-center">
          <span className="text-yellow-500 font-bold text-lg">★ {project.rating.toFixed(1)}</span>
          <span className="text-gray-500 ml-2">({project.numReviews} avis)</span>
        </div>
        <button 
          onClick={() => onReviewClick(project)} 
          className="text-primary font-semibold hover:underline"
        >
          Évaluer
        </button>
      </div>
    </div>
  </div>
);

// --- Composant interne pour la fenêtre modale d'avis ---
const ReviewModal = ({ project, onClose, onSubmitReview }) => {
  const { userInfo } = useAuth();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) {
      setError('Veuillez sélectionner une note.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onSubmitReview(project._id, { rating, comment });
      setLoading(false);
      onClose(); // Fermer la modale après succès
    } catch (err) {
      setError(err.response?.data?.message || 'Une erreur est survenue.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4">Laisser un avis sur "{project.title}"</h2>
        {error && <p className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</p>}
        
        {!userInfo ? (
          <p>Vous devez être <a href="/login" className="text-primary underline">connecté</a> pour laisser un avis.</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Votre note</label>
              <div className="flex space-x-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span 
                    key={star} 
                    onClick={() => setRating(star)} 
                    className={`cursor-pointer text-3xl ${rating >= star ? 'text-yellow-400' : 'text-gray-300'}`}
                  >
                    ★
                  </span>
                ))}
              </div>
            </div>
            <div className="mb-6">
              <label className="block text-gray-700 mb-2" htmlFor="comment">Votre commentaire</label>
              <textarea 
                id="comment" 
                rows="4"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="w-full px-3 py-2 border rounded"
                required
              ></textarea>
            </div>
            <div className="flex justify-end space-x-4">
              <button type="button" onClick={onClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded">Annuler</button>
              <button type="submit" disabled={loading} className="bg-primary text-white px-4 py-2 rounded disabled:bg-gray-400">
                {loading ? 'Envoi...' : 'Envoyer'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};


// --- Composant principal de la page Altcom ---
const AltcomPage = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedProject, setSelectedProject] = useState(null);
  const { userInfo } = useAuth();

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get('http://localhost:5000/api/projects');
      setProjects(data);
      setLoading(false);
    } catch (err) {
      setError("Erreur de chargement des projets.");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleReviewSubmit = async (projectId, reviewData) => {
    const config = {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userInfo.token}`,
      },
    };
    await axios.post(`http://localhost:5000/api/projects/${projectId}/reviews`, reviewData, config);
    // Recharger les projets pour afficher la nouvelle note
    fetchProjects(); 
  };

  if (loading) return <Spinner />;
  if (error) return <div className="text-center py-10 text-red-500">{error}</div>;

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold text-center text-primary mb-2">L'Art de la Visibilité Totale</h1>
      <p className="text-lg text-center text-gray-600 mb-12">Découvrez comment nous donnons vie aux marques à travers nos réalisations.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {projects.map(project => (
          <ProjectCard 
            key={project._id} 
            project={project} 
            onReviewClick={setSelectedProject} 
          />
        ))}
      </div>

      {selectedProject && (
        <ReviewModal 
          project={selectedProject} 
          onClose={() => setSelectedProject(null)} 
          onSubmitReview={handleReviewSubmit}
        />
      )}
    </div>
  );
};

export default AltcomPage;