import React from 'react';
import { motion } from 'framer-motion';
import { FaStar } from 'react-icons/fa';
import { Quote, Briefcase, Calendar } from 'lucide-react';

/**
 * Composant ReviewCard compatible avec votre structure de données existante
 * @param {Object} review - L'objet review contenant rating, comment, author, portfolioItem, etc.
 */
const ReviewCard = ({ review }) => {
  // === EXTRACTION DES DONNÉES AVEC FALLBACKS ===
  const rating = review.rating || 5;
  const comment = review.comment || review.content || "Excellent service et très professionnel.";
  
  // Gestion de l'auteur (peut être un string ou un objet populate)
  const authorName = typeof review.author === 'object' 
    ? review.author?.name 
    : review.author || "Client Anonyme";
  
  const authorPhoto = typeof review.author === 'object' 
    ? review.author?.photo 
    : null;

  // Gestion du projet associé
  const projectTitle = review.portfolioItem?.title || review.company || "Projet Confidentiel";
  const projectClient = review.portfolioItem?.client || null;
  
  // Formatage de la date
  const reviewDate = review.createdAt 
    ? new Date(review.createdAt).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : null;

  // === RENDU DES ÉTOILES ===
  const renderStars = () => {
    return (
      <div className="flex text-yellow-400 mb-4">
        {[...Array(5)].map((_, i) => (
          <FaStar 
            key={i} 
            className={i < rating ? 'text-yellow-400' : 'text-gray-300'} 
          />
        ))}
      </div>
    );
  };

  // === INITIALE POUR L'AVATAR ===
  const getInitial = (name) => {
    return name ? name.charAt(0).toUpperCase() : 'C';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ 
        y: -8, 
        boxShadow: "0 20px 40px rgba(0, 0, 0, 0.15)" 
      }}
      transition={{ duration: 0.3 }}
      className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-500 h-full flex flex-col justify-between relative overflow-hidden"
    >
      {/* Icône de citation en arrière-plan */}
      <div className="absolute top-4 right-4 opacity-5">
        <Quote className="w-16 h-16 text-blue-600" />
      </div>

      {/* Contenu principal */}
      <div className="relative z-10">
        {/* Étoiles */}
        {renderStars()}

        {/* Commentaire */}
        <p className="text-gray-600 italic mb-4 leading-relaxed">
          "{comment}"
        </p>
      </div>

      {/* Footer avec informations auteur */}
      <div className="mt-auto pt-4 border-t border-gray-200 relative z-10">
        <div className="flex items-center gap-3 mb-2">
          {/* Avatar ou Initiale */}
          {authorPhoto ? (
            <img 
              src={authorPhoto} 
              alt={authorName}
              className="w-10 h-10 rounded-full object-cover border-2 border-blue-500"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
              {getInitial(authorName)}
            </div>
          )}

          {/* Nom de l'auteur */}
          <div className="flex-1">
            <p className="font-semibold text-gray-800 text-right">
              - {authorName}
            </p>
          </div>
        </div>

        {/* Informations du projet */}
        {projectTitle && (
          <div className="flex items-center gap-2 text-gray-600 text-sm mt-2">
            <Briefcase className="w-4 h-4 text-blue-500" />
            <span className="line-clamp-1">
              {projectClient ? `${projectClient} - ${projectTitle}` : projectTitle}
            </span>
          </div>
        )}

        {/* Date de l'avis */}
        {reviewDate && (
          <div className="flex items-center gap-2 text-gray-400 text-xs mt-2">
            <Calendar className="w-3 h-3" />
            <span>{reviewDate}</span>
          </div>
        )}
      </div>

      {/* Badge pour les 5 étoiles */}
      {rating === 5 && (
        <div className="absolute top-4 left-4 z-10">
          <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md">
            ⭐ Excellent
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default ReviewCard;