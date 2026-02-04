import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Search,
  Filter,
  Loader2,
  Grid3x3,
  List,
  ChevronLeft,
  ChevronRight,
  Star,
  Calendar,
  Tag,
  X,
  SlidersHorizontal,
} from 'lucide-react';
import { getAllPortfolioItems } from '../services/portfolioService';

const ITEMS_PER_PAGE = 12;
const BACKEND_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'https://altitude-vision.onrender.com';

// 🔧 FONCTION UTILITAIRE POUR CONSTRUIRE L'URL DE L'IMAGE CORRECTEMENT
const getImageUrl = (imagePath) => {
  if (!imagePath) {
    return 'https://via.placeholder.com/400x300/3B82F6/FFFFFF?text=Altcom+Project';
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

const AltcomAnnonces = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // États
  const [portfolio, setPortfolio] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // grid ou list
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  // Filtres
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    category: searchParams.get('category') || 'all',
    sortBy: searchParams.get('sortBy') || 'recent',
  });

  // Catégories disponibles
  const categories = [
    'all',
    'Communication Digitale',
    'Branding & Design',
    'Stratégie de Contenu',
    'Campagne Publicitaire',
    'Site Web',
    'Réseaux Sociaux',
  ];

  // Charger les données
  useEffect(() => {
    fetchPortfolio();
  }, []);

  // Mettre à jour l'URL quand les filtres changent
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.category !== 'all') params.set('category', filters.category);
    if (filters.sortBy !== 'recent') params.set('sortBy', filters.sortBy);
    setSearchParams(params);
    setCurrentPage(1);
  }, [filters]);

  const fetchPortfolio = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAllPortfolioItems('Altcom');
      console.log('📦 Portfolio chargé:', data);
      setPortfolio(data || []);
    } catch (err) {
      console.error('❌ Erreur lors du chargement du portfolio:', err);
      setError('Impossible de charger le portfolio');
      setPortfolio([]);
    } finally {
      setLoading(false);
    }
  };

  // Filtrer et trier les données
  const getFilteredPortfolio = () => {
    let filtered = [...portfolio];

    // Filtre de recherche
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.title?.toLowerCase().includes(searchLower) ||
          item.description?.toLowerCase().includes(searchLower) ||
          item.client?.toLowerCase().includes(searchLower) ||
          item.tags?.some((tag) => tag.toLowerCase().includes(searchLower))
      );
    }

    // Filtre de catégorie
    if (filters.category !== 'all') {
      filtered = filtered.filter((item) => item.category === filters.category);
    }

    // Tri
    switch (filters.sortBy) {
      case 'recent':
        filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
      case 'oldest':
        filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        break;
      case 'rating':
        filtered.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
        break;
      case 'title':
        filtered.sort((a, b) => a.title.localeCompare(b.title));
        break;
      default:
        break;
    }

    return filtered;
  };

  const filteredPortfolio = getFilteredPortfolio();
  const totalPages = Math.ceil(filteredPortfolio.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentPortfolio = filteredPortfolio.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value });
  };

  const resetFilters = () => {
    setFilters({
      search: '',
      category: 'all',
      sortBy: 'recent',
    });
  };

  // Animations
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Chargement du portfolio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-gray-800">Portfolio Altcom</h1>
              <p className="text-gray-600">
                Découvrez nos {filteredPortfolio.length} projet{filteredPortfolio.length > 1 ? 's' : ''} de communication
              </p>
            </div>
          </div>
        </motion.div>

        {/* Barre de recherche et filtres */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Recherche */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Rechercher par titre, description, client, tags..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Boutons d'action */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition font-semibold"
              >
                <SlidersHorizontal className="w-5 h-5" />
                Filtres
              </button>

              <button
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                className="p-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                title={viewMode === 'grid' ? 'Vue liste' : 'Vue grille'}
              >
                {viewMode === 'grid' ? <List className="w-5 h-5" /> : <Grid3x3 className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Panneau de filtres */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-4 pt-4 border-t border-gray-200"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Catégorie */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Catégorie
                    </label>
                    <select
                      value={filters.category}
                      onChange={(e) => handleFilterChange('category', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat === 'all' ? 'Toutes les catégories' : cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Tri */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Trier par
                    </label>
                    <select
                      value={filters.sortBy}
                      onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="recent">Plus récent</option>
                      <option value="oldest">Plus ancien</option>
                      <option value="rating">Mieux notés</option>
                      <option value="title">Titre (A-Z)</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={resetFilters}
                  className="mt-4 flex items-center gap-2 text-blue-600 hover:text-blue-800 font-semibold"
                >
                  <X className="w-4 h-4" />
                  Réinitialiser les filtres
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Message d'erreur */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Grille de portfolio */}
        {currentPortfolio.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <Sparkles className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-700 mb-2">
              Aucun projet trouvé
            </h3>
            <p className="text-gray-500">
              Essayez de modifier vos critères de recherche
            </p>
          </div>
        ) : (
          <>
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className={
                viewMode === 'grid'
                  ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                  : 'space-y-6'
              }
            >
              {currentPortfolio.map((item) => (
                <motion.div key={item._id} variants={itemVariants}>
                  <PortfolioCard item={item} viewMode={viewMode} />
                </motion.div>
              ))}
            </motion.div>

            {/* Pagination */}
            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

// Composant Carte Portfolio - CORRIGÉ
const PortfolioCard = ({ item, viewMode }) => {
  const navigate = useNavigate();
  
  // 🔧 UTILISER LA FONCTION getImageUrl POUR CONSTRUIRE L'URL CORRECTEMENT
  const imageUrl = getImageUrl(item.images?.[0]);

  console.log('🖼️ Image URL pour', item.title, ':', imageUrl);

  if (viewMode === 'list') {
    return (
      <motion.div
        whileHover={{ scale: 1.01 }}
        onClick={() => navigate(`/altcom/portfolio/${item._id}`)}
        className="bg-white rounded-xl shadow-md hover:shadow-xl transition cursor-pointer overflow-hidden flex"
      >
        <img
          src={imageUrl}
          alt={item.title}
          className="w-48 h-48 object-cover"
          onError={(e) => {
            console.error('❌ Erreur chargement image (list):', imageUrl);
            e.target.src = 'https://via.placeholder.com/400x300/3B82F6/FFFFFF?text=Altcom';
            e.target.onerror = null;
          }}
          onLoad={() => {
            console.log('✅ Image chargée (list):', imageUrl);
          }}
        />
        <div className="flex-1 p-6">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">{item.title}</h3>
              <span className="inline-block px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold">
                {item.category}
              </span>
            </div>
            {item.averageRating > 0 && (
              <div className="flex items-center gap-1">
                <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                <span className="font-bold text-lg">{item.averageRating.toFixed(1)}</span>
              </div>
            )}
          </div>
          <p className="text-gray-600 mb-4 line-clamp-2">{item.description}</p>
          <div className="flex items-center justify-between text-sm text-gray-500">
            {item.client && (
              <span className="flex items-center gap-1">
                <Tag className="w-4 h-4" />
                {item.client}
              </span>
            )}
            {item.projectDate && (
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {new Date(item.projectDate).toLocaleDateString('fr-FR', {
                  year: 'numeric',
                  month: 'long',
                })}
              </span>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      onClick={() => navigate(`/altcom/portfolio/${item._id}`)}
      className="bg-white rounded-xl shadow-md hover:shadow-xl transition cursor-pointer overflow-hidden"
    >
      <div className="relative">
        <img
          src={imageUrl}
          alt={item.title}
          className="w-full h-56 object-cover"
          onError={(e) => {
            console.error('❌ Erreur chargement image (grid):', imageUrl);
            e.target.src = 'https://via.placeholder.com/400x300/3B82F6/FFFFFF?text=Altcom';
            e.target.onerror = null;
          }}
          onLoad={() => {
            console.log('✅ Image chargée (grid):', imageUrl);
          }}
        />
        {item.averageRating > 0 && (
          <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full flex items-center gap-1">
            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
            <span className="font-bold">{item.averageRating.toFixed(1)}</span>
          </div>
        )}
      </div>
      <div className="p-5">
        <span className="inline-block px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold mb-3">
          {item.category}
        </span>
        <h3 className="text-xl font-bold text-gray-800 mb-2 line-clamp-1">{item.title}</h3>
        <p className="text-gray-600 mb-4 line-clamp-2">{item.description}</p>
        <div className="flex items-center justify-between text-sm text-gray-500">
          {item.client && (
            <span className="flex items-center gap-1">
              <Tag className="w-4 h-4" />
              {item.client}
            </span>
          )}
          {item.projectDate && (
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {new Date(item.projectDate).getFullYear()}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// Composant Pagination
const Pagination = ({ currentPage, totalPages, onPageChange }) => (
  <div className="flex justify-center items-center gap-2 mt-12">
    <button
      onClick={() => onPageChange(Math.max(1, currentPage - 1))}
      disabled={currentPage === 1}
      className="p-2 rounded-lg bg-white shadow disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
    >
      <ChevronLeft className="w-5 h-5" />
    </button>

    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
      <button
        key={page}
        onClick={() => onPageChange(page)}
        className={`px-4 py-2 rounded-lg font-semibold transition ${
          page === currentPage
            ? 'bg-blue-600 text-white shadow-lg'
            : 'bg-white text-gray-700 hover:bg-gray-100 shadow'
        }`}
      >
        {page}
      </button>
    ))}

    <button
      onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
      disabled={currentPage === totalPages}
      className="p-2 rounded-lg bg-white shadow disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
    >
      <ChevronRight className="w-5 h-5" />
    </button>
  </div>
);

export default AltcomAnnonces;