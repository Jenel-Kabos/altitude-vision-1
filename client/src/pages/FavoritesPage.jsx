// src/pages/FavoritesPage.jsx
import React, { useEffect, useState } from 'react';
import { Heart, Home, Calendar, Briefcase } from 'lucide-react';
import { getMyFavorites } from '../services/likeService';
import PropertyCard from '../components/PropertyCard';
import EventCard from '../components/EventCard';

const FavoritesPage = () => {
  const [favorites, setFavorites] = useState({ properties: [], events: [], services: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    fetchFavorites();
  }, []);

  const fetchFavorites = async () => {
    try {
      setLoading(true);
      const data = await getMyFavorites();
      setFavorites(data);
    } catch (err) {
      console.error('Erreur:', err);
      setError('Impossible de charger vos favoris');
    } finally {
      setLoading(false);
    }
  };

  const totalFavorites = favorites.properties.length + favorites.events.length + favorites.services.length;

  const tabs = [
    { id: 'all', label: 'Tous', icon: Heart, count: totalFavorites },
    { id: 'properties', label: 'Altimmo', icon: Home, count: favorites.properties.length },
    { id: 'events', label: 'MilaEvents', icon: Calendar, count: favorites.events.length },
    { id: 'services', label: 'Altcom', icon: Briefcase, count: favorites.services.length },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Chargement de vos favoris...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded max-w-md">
          <p className="font-bold">Erreur</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4">
        {/* En-tête */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <Heart className="w-12 h-12 text-red-600 fill-current" />
          </div>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Mes Favoris</h1>
          <p className="text-gray-600 text-lg">
            Retrouvez tous les éléments que vous avez aimés
          </p>
        </div>

        {/* Onglets */}
        <div className="flex justify-center mb-8 flex-wrap gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all
                  ${activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                  }
                `}
              >
                <Icon size={20} />
                <span>{tab.label}</span>
                <span className={`
                  px-2 py-0.5 rounded-full text-xs font-bold
                  ${activeTab === tab.id ? 'bg-white text-blue-600' : 'bg-gray-200 text-gray-700'}
                `}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Contenu */}
        {totalFavorites === 0 ? (
          <div className="text-center py-20">
            <Heart className="w-24 h-24 text-gray-300 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-800 mb-2">Aucun favori pour le moment</h3>
            <p className="text-gray-600 mb-6">
              Commencez à liker des annonces pour les retrouver ici !
            </p>
            <a
              href="/"
              className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              Découvrir les annonces
            </a>
          </div>
        ) : (
          <>
            {/* Altimmo */}
            {(activeTab === 'all' || activeTab === 'properties') && favorites.properties.length > 0 && (
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                  <Home className="text-green-600" />
                  Altimmo ({favorites.properties.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {favorites.properties.map((property) => (
                    <PropertyCard key={property._id} property={property} />
                  ))}
                </div>
              </div>
            )}

            {/* MilaEvents */}
            {(activeTab === 'all' || activeTab === 'events') && favorites.events.length > 0 && (
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                  <Calendar className="text-purple-600" />
                  MilaEvents ({favorites.events.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {favorites.events.map((event) => (
                    <EventCard key={event._id} event={event} />
                  ))}
                </div>
              </div>
            )}

            {/* Altcom */}
            {(activeTab === 'all' || activeTab === 'services') && favorites.services.length > 0 && (
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                  <Briefcase className="text-orange-600" />
                  Altcom ({favorites.services.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Ajouter ServiceCard quand vous créerez le pôle Altcom */}
                  <p className="text-gray-500">Composant ServiceCard à créer</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default FavoritesPage;