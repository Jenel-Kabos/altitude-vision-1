// client/src/pages/LeaveReviewPage.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Send, Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'react-toastify';
import { createReview } from '../services/reviewService'; // Assure-toi du chemin
import { useAuth } from '../context/AuthContext';

const LeaveReviewPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0); // Pour l'effet de survol des étoiles
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

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

    try {
      setLoading(true);
      
      // Envoi au backend
      await createReview({
        rating,
        review: comment, // Adapte 'review' ou 'comment' selon ton Backend
        user: user._id // Souvent géré auto par le token, mais au cas où
      });

      toast.success("Merci ! Votre avis a été enregistré.");
      navigate('/'); // Retour à l'accueil ou vers la liste des avis
      
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
            
            {/* Note en Étoiles */}
            <div className="flex flex-col items-center space-y-2">
                <label className="text-sm font-medium text-gray-700">Votre note</label>
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
                <label className="text-sm font-medium text-gray-700">Votre commentaire</label>
                <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Qu'avez-vous pensé de nos services ?"
                    rows="4"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                ></textarea>
            </div>

            {/* Bouton Soumettre */}
            <button
                type="submit"
                disabled={loading}
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