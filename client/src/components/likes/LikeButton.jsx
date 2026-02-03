// src/components/likes/LikeButton.jsx
import React, { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { toggleLike, getLikeStatus } from '../../services/likeService';
import { useAuth } from '../../context/AuthContext';

/**
 * Bouton Like/Unlike avec animation
 * @param {String} targetType - 'Property' | 'Event' | 'Service'
 * @param {String} targetId - ID de l'élément
 * @param {String} size - Taille du bouton : 'sm' | 'md' | 'lg'
 * @param {Boolean} showCount - Afficher le nombre de likes
 */
const LikeButton = ({ targetType, targetId, size = 'md', showCount = true }) => {
  const { user } = useAuth();
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Tailles
  const sizes = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg'
  };

  const iconSizes = {
    sm: 16,
    md: 20,
    lg: 24
  };

  useEffect(() => {
    fetchLikeStatus();
  }, [targetType, targetId]);

  const fetchLikeStatus = async () => {
    try {
      const data = await getLikeStatus(targetType, targetId);
      setLiked(data.liked);
      setLikesCount(data.likesCount);
    } catch (error) {
      console.error('Erreur lors de la récupération du statut de like:', error);
    }
  };

  const handleLike = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      alert('Vous devez être connecté pour liker');
      return;
    }

    if (isLoading) return;

    setIsLoading(true);
    setIsAnimating(true);

    try {
      const result = await toggleLike(targetType, targetId);
      setLiked(result.liked);
      setLikesCount(result.likesCount);

      setTimeout(() => setIsAnimating(false), 300);
    } catch (error) {
      console.error('Erreur lors du like:', error);
      alert('Erreur lors du like. Veuillez réessayer.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleLike}
        disabled={isLoading || !user}
        className={`
          ${sizes[size]}
          flex items-center justify-center
          rounded-full transition-all duration-300
          ${liked 
            ? 'bg-red-100 hover:bg-red-200 text-red-600' 
            : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
          }
          ${isAnimating ? 'scale-125' : 'scale-100'}
          ${!user ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          disabled:cursor-not-allowed
        `}
        title={user ? (liked ? 'Ne plus aimer' : 'J\'aime') : 'Connectez-vous pour liker'}
      >
        <Heart
          size={iconSizes[size]}
          className={`transition-all duration-300 ${liked ? 'fill-current' : ''}`}
        />
      </button>

      {showCount && (
        <span className={`font-semibold ${liked ? 'text-red-600' : 'text-gray-600'}`}>
          {likesCount}
        </span>
      )}
    </div>
  );
};

export default LikeButton;