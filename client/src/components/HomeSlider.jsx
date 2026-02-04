import React from 'react';
import Slider from 'react-slick';
import { useNavigate } from 'react-router-dom';
import { Calendar, MapPin, User, Tag, Star, Home } from 'lucide-react';

// 🎯 IMPORTS DES COMPOSANTS DE CARTES
import PropertyCard from './PropertyCard';
import EventCard from './EventCard';
import PortfolioCard from './PortfolioCard';

// Imports CSS pour Slick Carousel
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';

const BACKEND_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'https://altitude-vision.onrender.com';

console.log('🔧 [HomeSlider] BACKEND_URL configuré:', BACKEND_URL);

/**
 * HomeSlider - Composant de carrousel pour afficher des propriétés, événements ou portfolios
 * @param {Array} properties - Tableau de données à afficher
 * @param {Boolean} isEvent - Si true, affiche des EventCard
 * @param {Boolean} isPortfolio - Si true, affiche des PortfolioCard
 * @param {Boolean} loading - État de chargement
 * @param {String} error - Message d'erreur
 */
const HomeSlider = ({ 
  properties = [], 
  isEvent = false, 
  isPortfolio = false, 
  loading = false, 
  error = null 
}) => {
  const navigate = useNavigate();

  const settings = {
    dots: true,
    infinite: properties.length > 1,
    speed: 500,
    slidesToShow: Math.min(3, properties.length),
    slidesToScroll: 1,
    autoplay: properties.length > 1,
    autoplaySpeed: 4000,
    arrows: true,
    pauseOnHover: true,
    responsive: [
      {
        breakpoint: 1024,
        settings: {
          slidesToShow: Math.min(2, properties.length),
          slidesToScroll: 1,
          arrows: true
        }
      },
      {
        breakpoint: 640,
        settings: {
          slidesToShow: 1,
          slidesToScroll: 1,
          arrows: false
        }
      }
    ]
  };

  // Gestion de l'état de chargement
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gradient-to-br from-slate-50 to-slate-100 rounded-3xl">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Chargement des annonces...</p>
        </div>
      </div>
    );
  }

  // Gestion des erreurs
  if (error) {
    return (
      <div className="flex items-center justify-center h-40 bg-red-50 rounded-3xl border border-red-200">
        <p className="text-red-600 text-center px-4 font-medium">
          ⚠️ {error}
        </p>
      </div>
    );
  }

  // Gestion du cas sans données
  if (!properties || properties.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 bg-gradient-to-br from-slate-50 to-blue-50 rounded-3xl border border-dashed border-blue-200">
        <p className="text-gray-500 italic font-medium">
          Aucune annonce disponible pour le moment.
        </p>
      </div>
    );
  }

  // Déterminer la couleur selon le pôle
  const getPrimaryColor = () => {
    if (isPortfolio) return 'blue'; // Altcom
    if (isEvent) return 'green'; // Mila Events
    return 'blue'; // Altimmo
  };

  const color = getPrimaryColor();

  return (
    <div className="home-slider-container">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        .home-slider-container { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
        .slick-dots { bottom: -45px; }
        .slick-dots li button:before {
          font-size: 10px;
          color: ${color === 'blue' ? '#3B82F6' : color === 'green' ? '#10B981' : '#EF4444'};
          opacity: 0.5;
        }
        .slick-dots li.slick-active button:before {
          opacity: 1;
        }
        .slick-prev, .slick-next {
          width: 40px;
          height: 40px;
          z-index: 10;
        }
        .slick-prev { left: -20px; }
        .slick-next { right: -20px; }
        .slick-prev:before, .slick-next:before {
          font-size: 40px;
          opacity: 0.5;
          color: ${color === 'blue' ? '#3B82F6' : color === 'green' ? '#10B981' : '#EF4444'};
        }
        .slick-prev:hover:before, .slick-next:hover:before { opacity: 1; }
      `}</style>

      <Slider {...settings}>
        {properties.map((item, index) => (
          <div key={item._id || index} className="px-2 sm:px-3">
            {/* 🎯 UTILISATION DES COMPOSANTS APPROPRIÉS */}
            {isEvent ? (
              <EventCard event={item} />
            ) : isPortfolio ? (
              <PortfolioCard item={item} />
            ) : (
              <PropertyCard property={item} />
            )}
          </div>
        ))}
      </Slider>
    </div>
  );
};

export default HomeSlider;