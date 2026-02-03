import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, Users } from 'lucide-react';
import LikeButton from './likes/LikeButton'; // ✅ AJOUT

const BACKEND_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || '';

const EventCard = ({ event }) => {
  const displayEvent = {
    _id: event._id,
    title: event.name || event.title,
    description: event.description,
    date: event.date,
    location: event.location,
    category: event.category || 'Événement',
    guests: event.guests,
  };

  const imagePath = event.images && event.images.length > 0 ? event.images[0] : null;
  
  let imageUrl;
  if (!imagePath) {
    imageUrl = 'https://images.unsplash.com/photo-1540555700478-4be29ab4cb3d?q=80&w=400&h=300&fit=crop';
  } else if (imagePath.startsWith('http')) {
    imageUrl = imagePath;
  } else {
    imageUrl = `${BACKEND_URL}/${imagePath.replace(/^\//, '')}`;
  }

  const formattedDate = new Date(displayEvent.date).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="relative group"> {/* ✅ Ajout de relative */}
      {/* ✅ Bouton Like en position absolue */}
      <div className="absolute top-4 left-4 z-10">
        <LikeButton 
          targetType="Event" 
          targetId={displayEvent._id} 
          size="md"
          showCount={true}
        />
      </div>

      <Link to={`/mila-events/event/${displayEvent._id}`} className="block">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden transform transition-all duration-300 group-hover:scale-105 group-hover:shadow-2xl">
          <div className="relative">
            <img 
              src={imageUrl} 
              alt={displayEvent.title} 
              className="w-full h-56 object-cover"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = 'https://images.unsplash.com/photo-1540555700478-4be29ab4cb3d?q=80&w=400&h=300&fit=crop';
              }}
            />
            <span className="absolute top-2 right-2 bg-purple-600 text-white text-sm font-semibold px-3 py-1 rounded-full">
              {displayEvent.category}
            </span>
          </div>
          
          <div className="p-4">
            <h3 className="text-xl font-bold text-gray-800 line-clamp-1">{displayEvent.title}</h3>
            
            <p className="text-gray-600 mt-2 line-clamp-2 text-sm min-h-[2.5rem]">
              {displayEvent.description}
            </p>
            
            <div className="mt-4 space-y-2 text-sm text-gray-600">
              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-2 text-blue-500 flex-shrink-0" />
                <span className="font-medium">{formattedDate}</span>
              </div>
              
              <div className="flex items-center">
                <MapPin className="w-4 h-4 mr-2 text-red-500 flex-shrink-0" />
                <span className="line-clamp-1">{displayEvent.location}</span>
              </div>
              
              {displayEvent.guests && (
                <div className="flex items-center">
                  <Users className="w-4 h-4 mr-2 text-green-500 flex-shrink-0" />
                  <span>{displayEvent.guests} invités</span>
                </div>
              )}
            </div>
            
            <button className="mt-4 w-full bg-purple-600 text-white py-2 rounded-lg font-semibold hover:bg-purple-700 transition-colors duration-200">
              Voir les détails →
            </button>
          </div>
        </div>
      </Link>
    </div>
  );
};

export default EventCard;