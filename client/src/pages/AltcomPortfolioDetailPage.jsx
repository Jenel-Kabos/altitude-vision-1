import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Calendar, 
  User, 
  Tag, 
  ExternalLink,
  Star,
  ChevronLeft,
  ChevronRight,
  Heart,
  Share2,
  Loader2,
  AlertCircle,
  Building2,
  Target,
  Award,
  TrendingUp
} from 'lucide-react';
import { getPortfolioItem } from '../services/portfolioService';

const BACKEND_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

// 🔧 FONCTION UTILITAIRE POUR CONSTRUIRE L'URL DE L'IMAGE CORRECTEMENT
const getImageUrl = (imagePath) => {
  if (!imagePath) {
    return 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1200&auto=format&fit=crop';
  }
  
  // Si l'image commence par http:// ou https://, c'est déjà une URL complète
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  
  // Si l'image commence par /uploads, ajouter le BACKEND_URL
  if (imagePath.startsWith('/uploads')) {
    return `${BACKEND_URL}${imagePath}`;
  }
  
  // Par défaut, retourner l'image telle quelle
  return imagePath;
};

const AltcomPortfolioDetailPage = () => {
  const { portfolioId } = useParams();
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isLiked, setIsLiked] = useState(false);

  useEffect(() => {
    fetchPortfolioDetails();
  }, [portfolioId]);

  const fetchPortfolioDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getPortfolioItem(portfolioId);
      
      if (data) {
        console.log('📦 Portfolio chargé:', data);
        console.log('🖼️ Images:', data.images);
        setPortfolio(data);
      } else {
        setError('Projet non trouvé');
      }
    } catch (err) {
      console.error('❌ Erreur lors du chargement du portfolio:', err);
      setError('Impossible de charger les détails du projet');
    } finally {
      setLoading(false);
    }
  };

  const handlePreviousImage = () => {
    setCurrentImageIndex((prev) => 
      prev === 0 ? portfolio.images.length - 1 : prev - 1
    );
  };

  const handleNextImage = () => {
    setCurrentImageIndex((prev) => 
      prev === portfolio.images.length - 1 ? 0 : prev + 1
    );
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: portfolio.title,
          text: portfolio.description,
          url: window.location.href,
        });
      } catch (err) {
        console.log('Partage annulé');
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Lien copié dans le presse-papiers !');
    }
  };

  const formatDate = (date) => {
    if (!date) return null;
    return new Date(date).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Chargement du projet...</p>
        </div>
      </div>
    );
  }

  if (error || !portfolio) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Projet non trouvé</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/altcom')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Retour à Altcom
          </button>
        </div>
      </div>
    );
  }

  // 🔧 UTILISER LA FONCTION getImageUrl POUR CONSTRUIRE L'URL CORRECTEMENT
  const currentImage = portfolio.images && portfolio.images.length > 0
    ? getImageUrl(portfolio.images[currentImageIndex])
    : 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1200&auto=format&fit=crop';

  console.log('🖼️ Image actuelle affichée:', currentImage);

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Header avec retour */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white shadow-sm sticky top-0 z-50"
      >
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/altcom')}
              className="flex items-center text-gray-600 hover:text-blue-600 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Retour aux réalisations
            </button>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsLiked(!isLiked)}
                className={`p-2 rounded-full transition-all ${
                  isLiked 
                    ? 'bg-red-100 text-red-600' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
              </button>
              <button
                onClick={handleShare}
                className="p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
              >
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Hero Section avec Galerie d'images */}
      <section className="bg-black">
        <div className="container mx-auto px-6 py-8">
          <div className="relative">
            {/* Image principale */}
            <motion.div
              key={currentImageIndex}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="relative h-[60vh] md:h-[70vh] rounded-2xl overflow-hidden"
            >
              <img
                src={currentImage}
                alt={portfolio.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  console.error('❌ Erreur chargement image principale:', currentImage);
                  e.target.src = 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1200&auto=format&fit=crop';
                  e.target.onerror = null;
                }}
                onLoad={() => {
                  console.log('✅ Image principale chargée:', currentImage);
                }}
              />
              
              {/* Overlay gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              
              {/* Catégorie et note */}
              <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                <span className="px-4 py-2 bg-white/90 backdrop-blur-sm rounded-full font-bold text-gray-800">
                  {portfolio.category}
                </span>
                {portfolio.averageRating > 0 && (
                  <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full">
                    <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                    <span className="font-bold text-gray-800">
                      {portfolio.averageRating.toFixed(1)}
                    </span>
                    <span className="text-gray-600 text-sm">
                      ({portfolio.reviewCount || 0})
                    </span>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Contrôles de navigation si plusieurs images */}
            {portfolio.images && portfolio.images.length > 1 && (
              <>
                <button
                  onClick={handlePreviousImage}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 p-3 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:bg-white transition z-10"
                >
                  <ChevronLeft className="w-6 h-6 text-gray-800" />
                </button>
                <button
                  onClick={handleNextImage}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 p-3 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:bg-white transition z-10"
                >
                  <ChevronRight className="w-6 h-6 text-gray-800" />
                </button>

                {/* Indicateurs */}
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 z-10">
                  {portfolio.images.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                      className={`h-2 rounded-full transition-all ${
                        index === currentImageIndex 
                          ? 'w-8 bg-white' 
                          : 'w-2 bg-white/50'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Miniatures - CORRIGÉES */}
          {portfolio.images && portfolio.images.length > 1 && (
            <div className="grid grid-cols-4 md:grid-cols-6 gap-4 mt-6">
              {portfolio.images.map((image, index) => {
                const thumbnailUrl = getImageUrl(image);
                return (
                  <motion.button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    whileHover={{ scale: 1.05 }}
                    className={`relative h-20 rounded-lg overflow-hidden ${
                      index === currentImageIndex 
                        ? 'ring-4 ring-blue-500' 
                        : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={thumbnailUrl}
                      alt={`${portfolio.title} - ${index + 1}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        console.error(`❌ Erreur miniature ${index + 1}:`, thumbnailUrl);
                        e.target.src = 'https://via.placeholder.com/150?text=Image';
                        e.target.onerror = null;
                      }}
                      onLoad={() => {
                        console.log(`✅ Miniature ${index + 1} chargée:`, thumbnailUrl);
                      }}
                    />
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Contenu principal */}
      <section className="container mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-3 gap-12">
          {/* Colonne principale */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-800 mb-6">
                {portfolio.title}
              </h1>

              {/* Métadonnées */}
              <div className="flex flex-wrap gap-4 mb-8 text-gray-600">
                {portfolio.client && (
                  <div className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    <span className="font-semibold">{portfolio.client}</span>
                  </div>
                )}
                {portfolio.projectDate && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    <span>{formatDate(portfolio.projectDate)}</span>
                  </div>
                )}
                {portfolio.completionDate && (
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5" />
                    <span>Terminé le {formatDate(portfolio.completionDate)}</span>
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Target className="w-6 h-6 text-blue-600" />
                  Description du projet
                </h2>
                <p className="text-gray-700 leading-relaxed text-lg whitespace-pre-wrap">
                  {portfolio.description}
                </p>
              </div>

              {/* Objectifs si disponibles */}
              {portfolio.objectives && portfolio.objectives.length > 0 && (
                <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
                  <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-6 h-6 text-green-600" />
                    Objectifs atteints
                  </h2>
                  <ul className="space-y-3">
                    {portfolio.objectives.map((objective, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <div className="mt-1 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-green-600 font-bold text-sm">✓</span>
                        </div>
                        <span className="text-gray-700 text-lg">{objective}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Résultats si disponibles */}
              {portfolio.results && (
                <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl shadow-lg p-8 mb-8">
                  <h2 className="text-2xl font-bold text-gray-800 mb-4">
                    Résultats obtenus
                  </h2>
                  <p className="text-gray-700 text-lg leading-relaxed">
                    {portfolio.results}
                  </p>
                </div>
              )}

              {/* Technologies/Services utilisés */}
              {portfolio.technologies && portfolio.technologies.length > 0 && (
                <div className="bg-white rounded-2xl shadow-lg p-8">
                  <h2 className="text-2xl font-bold text-gray-800 mb-4">
                    Technologies & Services
                  </h2>
                  <div className="flex flex-wrap gap-3">
                    {portfolio.technologies.map((tech, index) => (
                      <span
                        key={index}
                        className="px-4 py-2 bg-gradient-to-r from-blue-100 to-purple-100 text-gray-800 rounded-full font-semibold"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="sticky top-24 space-y-6"
            >
              {/* Informations du client */}
              {portfolio.client && (
                <div className="bg-white rounded-2xl shadow-lg p-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-blue-600" />
                    Client
                  </h3>
                  <p className="text-gray-700 font-semibold text-xl">
                    {portfolio.client}
                  </p>
                  {portfolio.clientIndustry && (
                    <p className="text-gray-500 mt-2">
                      Secteur: {portfolio.clientIndustry}
                    </p>
                  )}
                </div>
              )}

              {/* Tags */}
              {portfolio.tags && portfolio.tags.length > 0 && (
                <div className="bg-white rounded-2xl shadow-lg p-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Tag className="w-5 h-5 text-purple-600" />
                    Tags
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {portfolio.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Lien externe */}
              {portfolio.link && (
                <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl shadow-lg p-6 text-white">
                  <h3 className="text-lg font-bold mb-3">Voir le projet en ligne</h3>
                  <a
                    href={portfolio.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 bg-white text-blue-600 px-6 py-3 rounded-lg font-bold hover:bg-gray-100 transition"
                  >
                    <ExternalLink className="w-5 h-5" />
                    Visiter le site
                  </a>
                </div>
              )}

              {/* CTA Contact */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-3">
                  Un projet similaire ?
                </h3>
                <p className="text-gray-600 mb-4">
                  Contactez-nous pour discuter de vos besoins en communication.
                </p>
                <button
                  onClick={() => navigate('/altcom', { state: { openQuoteModal: true, service: portfolio.category } })}
                  className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 transition"
                >
                  Demander un devis
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Section Projets similaires */}
      <section className="bg-white py-16">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-bold text-gray-800 mb-8 text-center">
            Projets similaires
          </h2>
          <p className="text-center text-gray-600 mb-12">
            Découvrez d'autres réalisations dans la catégorie {portfolio.category}
          </p>
          <div className="text-center">
            <button
              onClick={() => navigate('/altcom#portfolio')}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition"
            >
              Voir toutes nos réalisations
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AltcomPortfolioDetailPage;