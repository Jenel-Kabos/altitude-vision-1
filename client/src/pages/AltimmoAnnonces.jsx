// src/pages/AltimmoAnnonces.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  MapPin,
  Search,
  X,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Grid3x3,
  List,
  SlidersHorizontal,
} from 'lucide-react';
import { getAllProperties } from '../services/propertyService';
import PropertyCard from '../components/PropertyCard';

const PROPERTIES_PER_PAGE = 12;

const CATEGORIES = ['Tous', 'Vente', 'Location', 'Viager'];
const PROPERTY_TYPES = ['Tous', 'Appartement', 'Maison', 'Villa', 'Terrain', 'Bureau', 'Commerce'];

const AltimmoAnnonces = () => {
  const navigate = useNavigate();
  const [properties, setProperties] = useState([]);
  const [filteredProperties, setFilteredProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tous');
  const [selectedType, setSelectedType] = useState('Tous');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('date-desc');
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });

  useEffect(() => {
    fetchProperties();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [properties, searchTerm, selectedCategory, selectedType, sortBy, priceRange]);

  const fetchProperties = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAllProperties({ pole: 'Altimmo' });
      setProperties(data || []);
      setFilteredProperties(data || []);
    } catch (err) {
      console.error('Erreur lors du chargement des propriétés:', err);
      setError('Impossible de charger les annonces');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...properties];

    if (searchTerm) {
      filtered = filtered.filter((property) => {
        const searchableText = [
          property.title || '',
          property.description || '',
          getLocationString(property),
        ].join(' ').toLowerCase();
        return searchableText.includes(searchTerm.toLowerCase());
      });
    }

    if (selectedCategory !== 'Tous') {
      filtered = filtered.filter((p) => p.transactionType === selectedCategory);
    }

    if (selectedType !== 'Tous') {
      filtered = filtered.filter((p) => p.propertyType === selectedType);
    }

    if (priceRange.min) {
      filtered = filtered.filter((p) => p.price >= parseInt(priceRange.min));
    }
    if (priceRange.max) {
      filtered = filtered.filter((p) => p.price <= parseInt(priceRange.max));
    }

    switch (sortBy) {
      case 'date-desc':
        filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
      case 'date-asc':
        filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        break;
      case 'price-asc':
        filtered.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        filtered.sort((a, b) => b.price - a.price);
        break;
      case 'surface-desc':
        filtered.sort((a, b) => (b.surface || 0) - (a.surface || 0));
        break;
      default:
        break;
    }

    setFilteredProperties(filtered);
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedCategory('Tous');
    setSelectedType('Tous');
    setSortBy('date-desc');
    setPriceRange({ min: '', max: '' });
  };

  const getLocationString = (property) => {
    if (typeof property.location === 'string') return property.location;
    if (property.address && typeof property.address === 'object') {
      return [property.address.street, property.address.district, property.address.city]
        .filter(Boolean)
        .join(' ');
    }
    if (typeof property.address === 'string') return property.address;
    return property.city || '';
  };

  const totalPages = Math.ceil(filteredProperties.length / PROPERTIES_PER_PAGE);
  const startIndex = (currentPage - 1) * PROPERTIES_PER_PAGE;
  const currentProperties = filteredProperties.slice(startIndex, startIndex + PROPERTIES_PER_PAGE);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 text-xl">Chargement des annonces...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-red-50 border-l-4 border-red-500 p-8 rounded-lg shadow-md max-w-md">
          <div className="flex items-center mb-4">
            <AlertCircle className="text-red-500 w-8 h-8 mr-3" />
            <h3 className="text-xl font-semibold text-red-800">Erreur</h3>
          </div>
          <p className="text-red-700 mb-6">{error}</p>
          <button
            onClick={fetchProperties}
            className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div
        className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-20 relative overflow-hidden"
        style={{
          backgroundImage:
            "linear-gradient(rgba(37, 99, 235, 0.9), rgba(67, 56, 202, 0.9)), url('https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=2073&auto=format&fit=crop')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="container mx-auto px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <h1 className="text-5xl lg:text-6xl font-extrabold mb-4">Nos Biens Immobiliers</h1>
            <p className="text-xl lg:text-2xl text-blue-100 max-w-3xl mx-auto">
              Découvrez notre sélection de propriétés exceptionnelles pour votre projet immobilier
            </p>
            <div className="mt-8 flex items-center justify-center gap-4 text-lg">
              <div className="bg-white/20 backdrop-blur-sm px-6 py-3 rounded-full">
                <span className="font-bold">{properties.length}</span> Biens
              </div>
              <div className="bg-white/20 backdrop-blur-sm px-6 py-3 rounded-full">
                <span className="font-bold">{PROPERTY_TYPES.length - 1}</span> Types
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-12">
        {/* Barre de recherche et filtres */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Rechercher un bien, une ville..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-lg"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition ${
                  showFilters ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <SlidersHorizontal className="w-5 h-5" />
                Filtres
              </button>

              <div className="flex bg-gray-100 rounded-xl p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition ${
                    viewMode === 'grid' ? 'bg-white shadow' : 'hover:bg-gray-200'
                  }`}
                >
                  <Grid3x3 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition ${
                    viewMode === 'list' ? 'bg-white shadow' : 'hover:bg-gray-200'
                  }`}
                >
                  <List className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-6 pt-6 border-t"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-gray-700 font-semibold mb-3">Type de transaction</label>
                    <div className="flex flex-wrap gap-2">
                      {CATEGORIES.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat)}
                          className={`px-4 py-2 rounded-full font-medium transition ${
                            selectedCategory === cat
                              ? 'bg-blue-600 text-white shadow-lg'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-700 font-semibold mb-3">Type de bien</label>
                    <select
                      value={selectedType}
                      onChange={(e) => setSelectedType(e.target.value)}
                      className="w-full p-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                    >
                      {PROPERTY_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-700 font-semibold mb-3">Trier par</label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="w-full p-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                    >
                      <option value="date-desc">Plus récent</option>
                      <option value="date-asc">Plus ancien</option>
                      <option value="price-asc">Prix croissant</option>
                      <option value="price-desc">Prix décroissant</option>
                      <option value="surface-desc">Surface décroissante</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-gray-700 font-semibold mb-3">Fourchette de prix (FCFA)</label>
                    <div className="flex gap-4">
                      <input
                        type="number"
                        placeholder="Prix min"
                        value={priceRange.min}
                        onChange={(e) => setPriceRange({ ...priceRange, min: e.target.value })}
                        className="flex-1 p-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <span className="flex items-center text-gray-500">—</span>
                      <input
                        type="number"
                        placeholder="Prix max"
                        value={priceRange.max}
                        onChange={(e) => setPriceRange({ ...priceRange, max: e.target.value })}
                        className="flex-1 p-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    onClick={resetFilters}
                    className="flex items-center gap-2 text-gray-600 hover:text-red-600 font-semibold transition"
                  >
                    <X className="w-5 h-5" />
                    Réinitialiser les filtres
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Résultats */}
        <div className="mb-6 flex items-center justify-between">
          <p className="text-gray-600 text-lg">
            <span className="font-bold text-gray-800">{filteredProperties.length}</span> bien
            {filteredProperties.length > 1 ? 's' : ''} trouvé{filteredProperties.length > 1 ? 's' : ''}
          </p>
          {(searchTerm ||
            selectedCategory !== 'Tous' ||
            selectedType !== 'Tous' ||
            priceRange.min ||
            priceRange.max) && (
            <button onClick={resetFilters} className="text-blue-600 hover:text-blue-700 font-semibold">
              Voir tous les biens
            </button>
          )}
        </div>

        {currentProperties.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-md p-16 text-center">
            <Home className="w-20 h-20 text-gray-300 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-800 mb-2">Aucun bien trouvé</h3>
            <p className="text-gray-600 mb-6">Essayez de modifier vos critères de recherche ou filtres</p>
            <button
              onClick={resetFilters}
              className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition font-semibold"
            >
              Réinitialiser les filtres
            </button>
          </div>
        ) : (
          <>
            <div
              className={
                viewMode === 'grid'
                  ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8'
                  : 'space-y-6'
              }
            >
              {currentProperties.map((property, index) => (
                <PropertyCard
                  key={property._id}
                  property={property}
                  index={index}
                  viewMode={viewMode}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-12">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-3 rounded-lg bg-white shadow disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-5 py-3 rounded-lg font-bold text-lg transition ${
                      page === currentPage
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'bg-white text-gray-700 hover:bg-gray-100 shadow'
                    }`}
                  >
                    {page}
                  </button>
                ))}

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-3 rounded-lg bg-white shadow disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AltimmoAnnonces;