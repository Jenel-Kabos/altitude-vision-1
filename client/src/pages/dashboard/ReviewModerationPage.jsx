// src/pages/dashboard/ReviewModerationPage.jsx
import React, { useEffect, useState } from 'react';
import api from '../../services/api'; 
import { 
  Filter, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  Star, 
  User, 
  MessageSquare,
  Calendar,
  AlertTriangle,
  Trash2,
  Reply
} from 'lucide-react';

const ReviewModerationPage = () => {
  const [reviews, setReviews] = useState([]);
  const [filteredReviews, setFilteredReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedReview, setSelectedReview] = useState(null);
  const [selectedPole, setSelectedPole] = useState('Tous');
  const [adminResponse, setAdminResponse] = useState('');
  const [stats, setStats] = useState({ total: 0, Altimmo: 0, MilaEvents: 0, Altcom: 0 });

  const poles = ['Tous', 'Altimmo', 'MilaEvents', 'Altcom'];

  // Récupération de tous les avis
  const fetchReviews = async () => {
    setLoading(true);
    try {
      const res = await api.get('/reviews', {
        params: { limit: 1000, sort: '-createdAt' }
      });
      
      const reviewsData = res.data.data || res.data;
      setReviews(reviewsData);
      setFilteredReviews(reviewsData);
      
      // Calcul des statistiques
      const newStats = {
        total: reviewsData.length,
        Altimmo: reviewsData.filter(r => r.pole === 'Altimmo').length,
        MilaEvents: reviewsData.filter(r => r.pole === 'MilaEvents').length,
        Altcom: reviewsData.filter(r => r.pole === 'Altcom').length,
      };
      setStats(newStats);
      
      console.log('✅ [ReviewModerationPage] Avis chargés:', newStats);
    } catch (err) {
      console.error('❌ [ReviewModerationPage] Erreur:', err);
      setError(err.response?.data?.message || "Impossible de charger les avis.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  // Filtrer par pôle
  useEffect(() => {
    if (selectedPole === 'Tous') {
      setFilteredReviews(reviews);
    } else {
      setFilteredReviews(reviews.filter(r => r.pole === selectedPole));
    }
  }, [selectedPole, reviews]);

  // Supprimer un avis
  const handleDeleteReview = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet avis ? Cette action est irréversible.')) {
      return;
    }

    try {
      await api.delete(`/reviews/${id}`);

      // Mise à jour locale
      const reviewToDelete = reviews.find(r => r._id === id);
      const updatedReviews = reviews.filter(r => r._id !== id);
      setReviews(updatedReviews);
      
      // Mise à jour des stats
      if (reviewToDelete) {
        setStats(prev => ({
          ...prev,
          total: prev.total - 1,
          [reviewToDelete.pole]: prev[reviewToDelete.pole] - 1
        }));
      }

      setSelectedReview(null);
      alert('Avis supprimé avec succès !');
    } catch (err) {
      console.error('❌ [ReviewModerationPage] Erreur suppression:', err);
      alert(err.response?.data?.message || "Une erreur est survenue lors de la suppression.");
    }
  };

  // Ajouter/Modifier une réponse admin
  const handleAdminResponse = async (reviewId) => {
    if (!adminResponse.trim()) {
      alert('Veuillez saisir une réponse.');
      return;
    }

    try {
      await api.patch(`/reviews/${reviewId}/admin-response`, {
        responseText: adminResponse
      });

      // Mise à jour locale
      const updatedReviews = reviews.map(r => {
        if (r._id === reviewId) {
          return {
            ...r,
            adminResponse: {
              text: adminResponse,
              respondedAt: new Date().toISOString(),
              respondedBy: { name: 'Admin' } // Sera remplacé par les vraies données du serveur
            }
          };
        }
        return r;
      });
      
      setReviews(updatedReviews);
      setAdminResponse('');
      
      // Rafraîchir les données pour avoir la vraie réponse du serveur
      fetchReviews();
      
      alert('Réponse ajoutée avec succès !');
      setSelectedReview(null);
    } catch (err) {
      console.error('❌ [ReviewModerationPage] Erreur réponse admin:', err);
      alert(err.response?.data?.message || "Une erreur est survenue.");
    }
  };

  // Supprimer la réponse admin
  const handleDeleteAdminResponse = async (reviewId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer votre réponse ?')) {
      return;
    }

    try {
      await api.delete(`/reviews/${reviewId}/admin-response`);

      // Mise à jour locale
      const updatedReviews = reviews.map(r => {
        if (r._id === reviewId) {
          const { adminResponse, ...rest } = r;
          return rest;
        }
        return r;
      });
      
      setReviews(updatedReviews);
      setAdminResponse('');
      
      alert('Réponse supprimée avec succès !');
      setSelectedReview(null);
    } catch (err) {
      console.error('❌ [ReviewModerationPage] Erreur suppression réponse:', err);
      alert(err.response?.data?.message || "Une erreur est survenue.");
    }
  };

  // Rendu des étoiles
  const renderStars = (rating) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={18}
            className={star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Chargement des avis...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded">
          <p className="font-bold">Erreur</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Modération des Avis</h1>
        
        {/* Statistiques */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-4 rounded-lg shadow">
            <p className="text-sm opacity-90">Total Avis</p>
            <p className="text-3xl font-bold">{stats.total}</p>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-4 rounded-lg shadow">
            <p className="text-sm opacity-90">Altimmo</p>
            <p className="text-3xl font-bold">{stats.Altimmo}</p>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-4 rounded-lg shadow">
            <p className="text-sm opacity-90">MilaEvents</p>
            <p className="text-3xl font-bold">{stats.MilaEvents}</p>
          </div>
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-4 rounded-lg shadow">
            <p className="text-sm opacity-90">Altcom</p>
            <p className="text-3xl font-bold">{stats.Altcom}</p>
          </div>
        </div>

        {/* Filtres */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="text-gray-600" size={20} />
          <span className="text-gray-600 font-medium">Filtrer par pôle :</span>
          {poles.map((pole) => (
            <button
              key={pole}
              onClick={() => setSelectedPole(pole)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                selectedPole === pole
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {pole}
              {pole !== 'Tous' && (
                <span className="ml-2 bg-white bg-opacity-30 px-2 py-0.5 rounded-full text-xs">
                  {stats[pole]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Liste des avis */}
      {filteredReviews.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">
            Aucun avis {selectedPole !== 'Tous' && `pour ${selectedPole}`}.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredReviews.map((review) => (
            <div
              key={review._id}
              className="border rounded-lg shadow-md p-4 flex flex-col cursor-pointer hover:shadow-xl transition-all duration-300 bg-white"
              onClick={() => setSelectedReview(review)}
            >
              {/* En-tête avec pôle et note */}
              <div className="flex items-start justify-between mb-3">
                <span className={`px-3 py-1 rounded-full text-xs font-bold text-white ${
                  review.pole === 'Altimmo' ? 'bg-blue-500' :
                  review.pole === 'MilaEvents' ? 'bg-purple-500' :
                  'bg-orange-500'
                }`}>
                  {review.pole}
                </span>
                {renderStars(review.rating)}
              </div>
              
              {/* Auteur */}
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                  {review.author?.photo ? (
                    <img src={review.author.photo} alt={review.author.name} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    review.author?.name?.charAt(0).toUpperCase() || 'U'
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{review.author?.name || 'Utilisateur'}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(review.createdAt).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>
              
              {/* Commentaire */}
              <p className="text-sm text-gray-600 mb-3 line-clamp-3 italic">
                "{review.comment}"
              </p>

              {/* Indicateurs */}
              <div className="flex items-center gap-2 mt-auto pt-3 border-t">
                {review.adminResponse && (
                  <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                    <Reply size={12} />
                    Répondu
                  </span>
                )}
                {review.rating === 5 && (
                  <span className="flex items-center gap-1 text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
                    <Star size={12} className="fill-current" />
                    Excellent
                  </span>
                )}
              </div>

              <button className="mt-4 w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition">
                <Eye size={18} />
                Voir les détails
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal Détails */}
      {selectedReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-3xl p-6 relative max-h-[90vh] overflow-y-auto">
            <button
              className="absolute top-4 right-4 text-gray-700 hover:text-red-600 text-2xl font-bold transition"
              onClick={() => {
                setSelectedReview(null);
                setAdminResponse('');
              }}
            >
              &times;
            </button>
            
            {/* En-tête */}
            <div className="flex items-start justify-between mb-4">
              <span className={`inline-block px-4 py-2 rounded-full text-sm font-bold text-white ${
                selectedReview.pole === 'Altimmo' ? 'bg-blue-500' :
                selectedReview.pole === 'MilaEvents' ? 'bg-purple-500' :
                'bg-orange-500'
              }`}>
                {selectedReview.pole}
              </span>
              {renderStars(selectedReview.rating)}
            </div>

            {/* Auteur */}
            <div className="flex items-center gap-3 mb-6 pb-4 border-b">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-2xl font-bold">
                {selectedReview.author?.photo ? (
                  <img src={selectedReview.author.photo} alt={selectedReview.author.name} className="w-full h-full rounded-full object-cover" />
                ) : (
                  selectedReview.author?.name?.charAt(0).toUpperCase() || 'U'
                )}
              </div>
              <div>
                <p className="text-xl font-bold text-gray-800">{selectedReview.author?.name || 'Utilisateur'}</p>
                <p className="text-sm text-gray-500 flex items-center gap-2">
                  <Calendar size={14} />
                  {new Date(selectedReview.createdAt).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
              </div>
            </div>

            {/* Commentaire */}
            <div className="mb-6">
              <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                <MessageSquare size={20} className="text-blue-600" />
                Commentaire
              </h3>
              <p className="text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-lg italic">
                "{selectedReview.comment}"
              </p>
            </div>

            {/* Réponse admin existante */}
            {selectedReview.adminResponse && (
              <div className="mb-6 bg-blue-50 p-4 rounded-lg border-l-4 border-blue-600">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <Reply size={20} className="text-blue-600" />
                    Réponse de l'administration
                  </h3>
                  <button
                    onClick={() => handleDeleteAdminResponse(selectedReview._id)}
                    className="text-red-500 hover:text-red-700 transition"
                    title="Supprimer la réponse"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                <p className="text-gray-700 mb-2">{selectedReview.adminResponse.text}</p>
                <p className="text-xs text-gray-500">
                  Par {selectedReview.adminResponse.respondedBy?.name || 'Admin'} le{' '}
                  {new Date(selectedReview.adminResponse.respondedAt).toLocaleDateString('fr-FR')}
                </p>
              </div>
            )}

            {/* Formulaire de réponse admin */}
            {!selectedReview.adminResponse && (
              <div className="mb-6">
                <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                  <Reply size={20} className="text-blue-600" />
                  Répondre à cet avis
                </h3>
                <textarea
                  value={adminResponse}
                  onChange={(e) => setAdminResponse(e.target.value)}
                  placeholder="Votre réponse en tant qu'administrateur..."
                  className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  rows="4"
                />
                <button
                  onClick={() => handleAdminResponse(selectedReview._id)}
                  className="mt-2 flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  <Reply size={18} />
                  Publier la réponse
                </button>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 flex-wrap border-t pt-4">
              <button
                onClick={() => handleDeleteReview(selectedReview._id)}
                className="flex items-center gap-2 bg-red-500 text-white px-6 py-3 rounded-lg hover:bg-red-600 transition font-medium shadow-lg"
              >
                <Trash2 size={20} />
                Supprimer l'avis
              </button>
              <button
                onClick={() => {
                  setSelectedReview(null);
                  setAdminResponse('');
                }}
                className="bg-gray-300 text-gray-800 px-6 py-3 rounded-lg hover:bg-gray-400 transition font-medium"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewModerationPage;