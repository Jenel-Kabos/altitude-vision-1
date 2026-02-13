import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Send, Loader2, ArrowLeft, Building2, Calendar, Briefcase } from 'lucide-react';
import { toast } from 'react-toastify';
import { createReview } from '../services/reviewService';
import { useAuth } from '../context/AuthContext';

// ✅ Liste des pôles disponibles
const POLES = [
  { 
    id: 'Altimmo', 
    name: 'Altimmo', 
    icon: Building2,
    description: 'Immobilier de luxe',
    gradient: 'from-blue-600 to-sky-500'
  },
  { 
    id: 'MilaEvents', 
    name: 'Mila Events', 
    icon: Calendar,
    description: 'Organisation d\'événements',
    gradient: 'from-emerald-600 to-green-500'
  },
  { 
    id: 'Altcom', 
    name: 'Altcom', 
    icon: Briefcase,
    description: 'Communication digitale',
    gradient: 'from-indigo-600 to-violet-500'
  }
];

const LeaveReviewPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedPole, setSelectedPole] = useState('');

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

    if (!selectedPole) {
      toast.error("Veuillez sélectionner un pôle.");
      return;
    }

    try {
      setLoading(true);
      
      await createReview({
        rating,
        comment,
        pole: selectedPole,
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
            
            {/* ✅ Sélection du pôle */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Pôle concerné <span className="text-red-500">*</span>
              </label>
              
              <div className="grid grid-cols-1 gap-3">
                {POLES.map((pole) => {
                  const Icon = pole.icon;
                  const isSelected = selectedPole === pole.id;
                  
                  return (
                    <button
                      key={pole.id}
                      type="button"
                      onClick={() => setSelectedPole(pole.id)}
                      className={`
                        relative p-4 rounded-xl border-2 transition-all duration-300 text-left
                        ${isSelected 
                          ? `border-blue-500 bg-gradient-to-r ${pole.gradient} bg-opacity-10 shadow-lg` 
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                        }
                      `}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`
                          p-2 rounded-lg flex-shrink-0
                          ${isSelected 
                            ? `bg-gradient-to-br ${pole.gradient}` 
                            : 'bg-gray-100'
                          }
                        `}>
                          <Icon className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-gray-600'}`} />
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900">{pole.name}</div>
                          <div className="text-sm text-gray-600">{pole.description}</div>
                        </div>
                        {isSelected && (
                          <div className="flex-shrink-0">
                            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
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
              disabled={loading || !selectedPole}
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