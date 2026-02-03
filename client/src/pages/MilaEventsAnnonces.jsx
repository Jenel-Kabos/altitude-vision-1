// src/pages/MilaEventsAnnonces.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  MapPin,
  Tag,
  Search,
  Filter,
  X,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Users,
  Video,
  Grid3x3,
  List,
  SlidersHorizontal,
} from 'lucide-react';
import { getAllEvents } from '../services/eventService';
import { getFirstValidImage } from '../utils/imageUtils';

const EVENTS_PER_PAGE = 12;

const CATEGORIES = [
  'Tous',
  'Événement',
  'Mariage',
  'Gala',
  'Conférence',
  'Anniversaire',
  'Lancement',
];

const MilaEventsAnnonces = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tous');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' ou 'list'
  const [sortBy, setSortBy] = useState('date-desc');

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [events, searchTerm, selectedCategory, sortBy]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAllEvents();
      setEvents(data);
      setFilteredEvents(data);
    } catch (err) {
      console.error('Erreur lors du chargement des événements:', err);
      setError('Impossible de charger les événements');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...events];

    // Filtre par recherche
    if (searchTerm) {
      filtered = filtered.filter(
        (event) =>
          event.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          event.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          event.location?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtre par catégorie
    if (selectedCategory !== 'Tous') {
      filtered = filtered.filter((event) => event.category === selectedCategory);
    }

    // Tri
    switch (sortBy) {
      case 'date-desc':
        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
        break;
      case 'date-asc':
        filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
        break;
      case 'name-asc':
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name-desc':
        filtered.sort((a, b) => b.name.localeCompare(a.name));
        break;
      default:
        break;
    }

    setFilteredEvents(filtered);
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedCategory('Tous');
    setSortBy('date-desc');
  };

  const totalPages = Math.ceil(filteredEvents.length / EVENTS_PER_PAGE);
  const startIndex = (currentPage - 1) * EVENTS_PER_PAGE;
  const currentEvents = filteredEvents.slice(startIndex, startIndex + EVENTS_PER_PAGE);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 text-xl">Chargement des événements...</p>
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
            onClick={fetchEvents}
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
        className="bg-gradient-to-r from-blue-600 to-purple-700 text-white py-20 relative overflow-hidden"
        style={{
          backgroundImage:
            "linear-gradient(rgba(37, 99, 235, 0.9), rgba(126, 34, 206, 0.9)), url('https://images.unsplash.com/photo-1540555700478-4be29ab4cb3d?q=80&w=2070&auto=format&fit=crop')",
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
            <h1 className="text-5xl lg:text-6xl font-extrabold mb-4">
              Nos Événements Inoubliables
            </h1>
            <p className="text-xl lg:text-2xl text-blue-100 max-w-3xl mx-auto">
              Découvrez notre portfolio d'événements exceptionnels réalisés avec passion et expertise
            </p>
            <div className="mt-8 flex items-center justify-center gap-4 text-lg">
              <div className="bg-white/20 backdrop-blur-sm px-6 py-3 rounded-full">
                <span className="font-bold">{events.length}</span> Événements
              </div>
              <div className="bg-white/20 backdrop-blur-sm px-6 py-3 rounded-full">
                <span className="font-bold">{CATEGORIES.length - 1}</span> Catégories
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-12">
        {/* Barre de recherche et filtres */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4 items-center">
            {/* Recherche */}
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Rechercher un événement, lieu..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-lg"
              />
            </div>

            {/* Boutons d'action */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition ${
                  showFilters
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                  title="Vue grille"
                >
                  <Grid3x3 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition ${
                    viewMode === 'list' ? 'bg-white shadow' : 'hover:bg-gray-200'
                  }`}
                  title="Vue liste"
                >
                  <List className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Panneau de filtres */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-6 pt-6 border-t"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Catégories */}
                  <div>
                    <label className="block text-gray-700 font-semibold mb-3">
                      Catégorie
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {CATEGORIES.map((category) => (
                        <button
                          key={category}
                          onClick={() => setSelectedCategory(category)}
                          className={`px-4 py-2 rounded-full font-medium transition ${
                            selectedCategory === category
                              ? 'bg-blue-600 text-white shadow-lg'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {category}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tri */}
                  <div>
                    <label className="block text-gray-700 font-semibold mb-3">
                      Trier par
                    </label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="w-full p-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                    >
                      <option value="date-desc">Date (Plus récent)</option>
                      <option value="date-asc">Date (Plus ancien)</option>
                      <option value="name-asc">Nom (A-Z)</option>
                      <option value="name-desc">Nom (Z-A)</option>
                    </select>
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
            <span className="font-bold text-gray-800">{filteredEvents.length}</span>{' '}
            événement{filteredEvents.length > 1 ? 's' : ''} trouvé{filteredEvents.length > 1 ? 's' : ''}
          </p>
          {(searchTerm || selectedCategory !== 'Tous') && (
            <button
              onClick={resetFilters}
              className="text-blue-600 hover:text-blue-700 font-semibold"
            >
              Voir tous les événements
            </button>
          )}
        </div>

        {/* Liste des événements */}
        {currentEvents.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-md p-16 text-center">
            <Calendar className="w-20 h-20 text-gray-300 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-800 mb-2">Aucun événement trouvé</h3>
            <p className="text-gray-600 mb-6">
              Essayez de modifier vos critères de recherche ou filtres
            </p>
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
              {currentEvents.map((event, index) => (
                <EventCard key={event._id} event={event} index={index} viewMode={viewMode} />
              ))}
            </div>

            {/* Pagination */}
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

// Composant Carte d'Événement
const EventCard = ({ event, index, viewMode }) => {
  const navigate = useNavigate();

  const displayEvent = {
    _id: event._id,
    title: event.name || event.title,
    description: event.description,
    date: event.date,
    location: event.location,
    imageUrl: getFirstValidImage(
      event.images,
      'https://images.unsplash.com/photo-1540555700478-4be29ab4cb3d?q=80&w=2070&auto=format&fit=crop'
    ),
    category: event.category || 'Événement',
    guests: event.guests,
    videos: event.videos || [],
  };

  const formattedDate = new Date(displayEvent.date).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const handleCardClick = () => {
    navigate(`/mila-events/event/${displayEvent._id}`);
  };

  if (viewMode === 'list') {
    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: index * 0.05 }}
        onClick={handleCardClick}
        className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer group"
      >
        <div className="flex flex-col md:flex-row">
          <div className="relative md:w-1/3 h-64 md:h-auto overflow-hidden">
            <img
              src={displayEvent.imageUrl}
              alt={displayEvent.title}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              onError={(e) => {
                e.target.src = 'https://placehold.co/800x600/60A5FA/FFFFFF?text=Mila+Events';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
            <span className="absolute top-4 left-4 bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1">
              <Tag className="w-3 h-3" />
              {displayEvent.category}
            </span>
            {displayEvent.videos.length > 0 && (
              <span className="absolute top-4 right-4 bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1">
                <Video className="w-3 h-3" />
                {displayEvent.videos.length}
              </span>
            )}
          </div>

          <div className="p-6 md:w-2/3 flex flex-col justify-between">
            <div>
              <h3 className="text-2xl font-bold text-gray-800 mb-3 group-hover:text-blue-600 transition">
                {displayEvent.title}
              </h3>
              <p className="text-gray-600 mb-4 line-clamp-2">{displayEvent.description}</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center text-gray-600">
                <Calendar className="w-5 h-5 mr-3 text-blue-500" />
                <span className="font-semibold">{formattedDate}</span>
              </div>
              <div className="flex items-center text-gray-600">
                <MapPin className="w-5 h-5 mr-3 text-red-500" />
                <span>{displayEvent.location}</span>
              </div>
              {displayEvent.guests && (
                <div className="flex items-center text-gray-600">
                  <Users className="w-5 h-5 mr-3 text-purple-500" />
                  <span className="font-semibold">{displayEvent.guests} invités</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      onClick={handleCardClick}
      className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer group"
    >
      <div className="relative h-64 overflow-hidden">
        <img
          src={displayEvent.imageUrl}
          alt={displayEvent.title}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          onError={(e) => {
            e.target.src = 'https://placehold.co/800x600/60A5FA/FFFFFF?text=Mila+Events';
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
        <span className="absolute top-4 left-4 bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1">
          <Tag className="w-3 h-3" />
          {displayEvent.category}
        </span>
        {displayEvent.videos.length > 0 && (
          <span className="absolute top-4 right-4 bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1">
            <Video className="w-3 h-3" />
            {displayEvent.videos.length}
          </span>
        )}
        {displayEvent.guests && (
          <span className="absolute bottom-4 right-4 bg-purple-600 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1">
            <Users className="w-3 h-3" />
            {displayEvent.guests}
          </span>
        )}
        <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/20 transition-all duration-300 flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 bg-white text-blue-600 px-6 py-3 rounded-full font-bold shadow-xl transform scale-90 group-hover:scale-100 transition-all duration-300">
            Voir les détails →
          </span>
        </div>
      </div>

      <div className="p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-3 group-hover:text-blue-600 transition line-clamp-2">
          {displayEvent.title}
        </h3>
        <p className="text-gray-600 mb-4 line-clamp-2">{displayEvent.description}</p>

        <div className="space-y-2 text-sm">
          <div className="flex items-center text-gray-600">
            <Calendar className="w-4 h-4 mr-2 text-blue-500" />
            <span className="font-semibold">{formattedDate}</span>
          </div>
          <div className="flex items-center text-gray-600">
            <MapPin className="w-4 h-4 mr-2 text-red-500" />
            <span className="line-clamp-1">{displayEvent.location}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default MilaEventsAnnonces;