import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, Calendar, User, Tag, ExternalLink } from 'lucide-react';
import LikeButton from './likes/LikeButton'; // ✅ AJOUT

// 🔧 CORRECTION: Utilisation correcte de BACKEND_URL
const BACKEND_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

console.log('🔧 [PortfolioCard] BACKEND_URL:', BACKEND_URL);

// 🔧 FONCTION UTILITAIRE POUR CONSTRUIRE L'URL DE L'IMAGE
const getImageUrl = (imagePath) => {
  if (!imagePath) {
    console.warn('⚠️ [PortfolioCard] Pas de chemin d\'image fourni');
    return 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&auto=format&fit=crop';
  }

  console.log('📸 [PortfolioCard] Chemin image reçu:', imagePath);
  
  // Si l'image commence par http:// ou https://, c'est déjà une URL complète
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    console.log('✅ [PortfolioCard] URL complète détectée:', imagePath);
    return imagePath;
  }
  
  // Si l'image commence par /uploads
  if (imagePath.startsWith('/uploads')) {
    const finalUrl = `${BACKEND_URL}${imagePath}`;
    console.log('✅ [PortfolioCard] URL construite (uploads):', finalUrl);
    return finalUrl;
  }
  
  // Si l'image ne commence pas par /
  if (!imagePath.startsWith('/')) {
    const finalUrl = `${BACKEND_URL}/${imagePath}`;
    console.log('✅ [PortfolioCard] URL construite (relatif):', finalUrl);
    return finalUrl;
  }
  
  // Par défaut
  const finalUrl = `${BACKEND_URL}${imagePath}`;
  console.log('✅ [PortfolioCard] URL construite (défaut):', finalUrl);
  return finalUrl;
};

/**
 * Composant de carte pour afficher un projet du portfolio Altcom
 * @param {Object} item - L'objet portfolio contenant _id, title, images, description, client, category, etc.
 */
const PortfolioCard = ({ item }) => {
  const navigate = useNavigate();

  // Construire l'URL de l'image (prend la première image ou utilise un fallback)
  const imageUrl = getImageUrl(item.images?.[0]);

  // Formater la date du projet
  const formatDate = (date) => {
    if (!date) return null;
    return new Date(date).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long'
    });
  };

  // Navigation vers la page de détails
  const handleClick = () => {
    navigate(`/altcom/portfolio/${item._id}`);
  };

  return (
    <div className="relative group h-full"> {/* ✅ Ajout de relative et h-full */}
      {/* ✅ Bouton Like en position absolue */}
      <div className="absolute top-4 left-4 z-10">
        <div className="bg-white/90 backdrop-blur-sm rounded-full p-1.5 shadow-lg hover:bg-white transition-all">
          <LikeButton 
            targetType="Portfolio" 
            targetId={item._id} 
            size="sm"
            showCount={false}
          />
        </div>
      </div>

      <motion.div
        onClick={handleClick}
        initial={{ scale: 1 }}
        whileHover={{ scale: 1.03 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer hover:shadow-xl hover:border-blue-200 hover:-translate-y-1 transition-all duration-300 h-full flex flex-col"
      >
      {/* Image */}
      <div className="relative h-56 overflow-hidden">
        <motion.img
          whileHover={{ scale: 1.1 }}
          transition={{ duration: 0.6 }}
          src={imageUrl}
          alt={item.title}
          className="w-full h-full object-cover"
          onError={(e) => {
            console.error('❌ [PortfolioCard] Erreur chargement image:', imageUrl);
            e.target.onerror = null; 
            e.target.src = 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&auto=format&fit=crop';
          }}
          onLoad={() => {
            console.log('✅ [PortfolioCard] Image chargée avec succès:', imageUrl);
          }}
        />
        
        {/* Overlay avec catégorie et CTA */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
            {item.category && (
              <span className="inline-flex items-center px-4 py-2 bg-white/90 backdrop-blur-md text-gray-800 rounded-full text-sm font-bold shadow-lg">
                <Tag className="w-3.5 h-3.5 mr-1.5" />
                {item.category}
              </span>
            )}
            <span className="text-white font-semibold text-sm bg-blue-600/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg transition-all group-hover:bg-blue-600">
              Voir le projet →
            </span>
          </div>
        </div>

        {/* Badge note si disponible */}
        {item.averageRating && item.averageRating > 0 && (
          <div className="absolute top-3 right-3 flex items-center gap-1 bg-white/90 backdrop-blur-md px-3 py-2 rounded-full shadow-lg">
            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
            <span className="font-bold text-gray-800">{item.averageRating.toFixed(1)}</span>
          </div>
        )}
      </div>

      {/* Contenu textuel */}
      <div className="p-5 flex-1 flex flex-col">
        <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
          {item.title}
        </h3>

        <p className="text-gray-600 mb-4 line-clamp-3 text-sm leading-relaxed flex-1">
          {item.description}
        </p>

        {/* Métadonnées */}
        <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-4 pb-4 border-t pt-4 border-gray-100">
          {item.client && (
            <div className="flex items-center gap-1.5">
              <div className="p-1 rounded-lg bg-blue-50">
                <User className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <span className="font-medium">{item.client}</span>
            </div>
          )}
          
          {item.projectDate && (
            <div className="flex items-center gap-1.5">
              <div className="p-1 rounded-lg bg-blue-50">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <span className="font-medium">{formatDate(item.projectDate)}</span>
            </div>
          )}
        </div>

        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {item.tags.slice(0, 3).map((tag, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-gradient-to-r from-blue-50 to-sky-50 border border-blue-200 text-blue-700 rounded-full text-xs font-semibold"
              >
                {tag}
              </span>
            ))}
            {item.tags.length > 3 && (
              <span className="px-3 py-1 bg-gray-50 text-gray-500 rounded-full text-xs font-medium">
                +{item.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Lien externe si disponible */}
        {item.link && (
          <motion.button
            onClick={(e) => {
              e.stopPropagation();
              window.open(item.link, '_blank', 'noopener,noreferrer');
            }}
            whileHover={{ x: 5 }}
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold text-sm mt-4"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Visiter le site</span>
          </motion.button>
        )}
      </div>

      {/* Indicateur de nombre d'avis */}
      {item.reviewCount > 0 && (
        <div className="px-5 pb-5 pt-2 border-t border-gray-100">
          <p className="text-xs text-gray-500 font-medium">
            {item.reviewCount} avis client{item.reviewCount > 1 ? 's' : ''}
          </p>
        </div>
      )}
    </motion.div>
    </div>
  );
};

export default PortfolioCard;