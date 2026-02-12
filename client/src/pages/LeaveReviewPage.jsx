// client/src/pages/LeaveReviewPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Send, Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'react-toastify';
import { createReview } from '../services/reviewService';
import { useAuth } from '../context/AuthContext';

const LeaveReviewPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [portfolioItems, setPortfolioItems] = useState([]);
  const [selectedPortfolioItem, setSelectedPortfolioItem] = useState('');

  // ✅ AJOUT : Récupérer la liste des projets portfolio au chargement
  useEffect(() => {
    const fetchPortfolioItems = async () => {
      try {
        const response = await fetch('https://altitude-vision.onrender.com/api/portfolio');
        const data = await response.json();
        
        // Adapter selon la structure de votre API
        const items = data.data?.portfolioItems || data.data || data.portfolioItems || data;
        setPortfolioItems(items);
        
        // ✅ Sélectionner automatiquement le premier item s'il existe
        if (items.length > 0) {
          setSelectedPortfolioItem(items[0]._id);
        }
      } catch (error) {
        console.error('Erreur lors du chargement des projets:', error);
        toast.error('Impossible de charger les projets');
      }
    };

    fetchPortfolioItems();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (rating === 0) {
      toast.error("Veuillez sélectionner une note (étoiles).");
      return;
    }
    
    if (comment.trim().length < 10) {
      toast.error("Votre commentaire doit faire au moins 10 caractères.");
      return;
    }

    // ✅ AJOUT : Vérifier qu'un projet est sélectionné
    if (!selectedPortfolioItem) {
      toast.error("Veuillez sélectionner un projet.");
      return;
    }

    try {
      setLoading(true);
      
      // ✅ CORRECTION : Envoyer les bons champs attendus par le backend
      await createReview({
        rating,
        comment, // ✅ "comment" au lieu de "review"
        portfolioItem: selectedPortfolioItem, // ✅ AJOUT obligatoire
      });

      toast.success("Merci ! Votre avis a été enregistré.");
      navigate('/');
      
    } catch (error) {
      console.error(error);
      const msg = error.response?.data?.message || "Erreur lors de l'envoi de l'avis.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        
        {/* Header */}
        <div className="bg-blue-600 p-6 text-center relative">
          <button 
            onClick={() => navigate(-1)} 
            className="absolute left-4 top-6 text-white/80 hover:text-white"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-2xl font-bold text-white">Donnez votre avis</h1>
          <p className="text-blue-100 mt-2">Partagez votre expérience avec la communauté.</p>
        </div>

        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* ✅ AJOUT : Sélection du projet */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Projet concerné <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedPortfolioItem}
                onChange={(e) => setSelectedPortfolioItem(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                required
              >
                <option value="">Sélectionnez un projet</option>
                {portfolioItems.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.title || item.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Note en Étoiles */}
            <div className="flex flex-col items-center space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Votre note <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    type="button"
                    key={star}
                    className="focus:outline-none transition-transform hover:scale-110"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHover(star)}
                    onMouseLeave={() => setHover(rating)}
                  >
                    <Star 
                      size={32} 
                      className={`${
                        star <= (hover || rating) 
                          ? "fill-yellow-400 text-yellow-400" 
                          : "text-gray-300"
                      } transition-colors duration-200`} 
                    />
                  </button>
                ))}
              </div>
              <p className="text-sm text-gray-500 h-5">
                {hover === 1 && "Décevant"}
                {hover === 2 && "Moyen"}
                {hover === 3 && "Bien"}
                {hover === 4 && "Très bien"}
                {hover === 5 && "Excellent !"}
              </p>
            </div>

            {/* Commentaire */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Votre commentaire <span className="text-red-500">*</span>
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Qu'avez-vous pensé de nos services ?"
                rows="4"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                required
                minLength={10}
              ></textarea>
              <p className="text-xs text-gray-500">
                {comment.length}/10 caractères minimum
              </p>
            </div>

            {/* Bouton Soumettre */}
            <button
              type="submit"
              disabled={loading || !selectedPortfolioItem}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={20} /> Envoi en cours...
                </>
              ) : (
                <>
                  <Send size={20} /> Envoyer mon avis
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LeaveReviewPage;