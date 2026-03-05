import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Users, ArrowRight, Video } from 'lucide-react';
import LikeButton from './likes/LikeButton';

const BACKEND_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || '';

const EventCard = ({ event, index = 0 }) => {
    const navigate = useNavigate();

    const displayEvent = {
        _id: event._id,
        title: event.name || event.title,
        description: event.description,
        date: event.date,
        location: event.location,
        category: event.category || 'Événement',
        guests: event.guests,
        videos: event.videos || [],
    };

    const imagePath = event.images && event.images.length > 0 ? event.images[0] : null;

    let imageUrl;
    if (!imagePath) {
        imageUrl = 'https://images.unsplash.com/photo-1540555700478-4be29ab4cb3d?q=80&w=600&h=400&fit=crop';
    } else if (imagePath.startsWith('http')) {
        imageUrl = imagePath;
    } else {
        imageUrl = `${BACKEND_URL}/${imagePath.replace(/^\//, '')}`;
    }

    const formattedDate = displayEvent.date
        ? new Date(displayEvent.date).toLocaleDateString('fr-FR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
          })
        : 'Date non définie';

    const handleClick = () => navigate(`/mila-events/event/${displayEvent._id}`);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.4, delay: index * 0.05 }}
            className="relative group h-full"
        >
            {/* Bouton Like – glassmorphism cohérent avec PropertyCard */}
            <div className="absolute top-4 left-4 z-10">
                <div className="bg-white/90 backdrop-blur-sm rounded-full p-1.5 shadow-lg hover:bg-white transition-all">
                    <LikeButton
                        targetType="Event"
                        targetId={displayEvent._id}
                        size="sm"
                        showCount={false}
                    />
                </div>
            </div>

            {/* Badge vidéos */}
            {displayEvent.videos?.length > 0 && (
                <div className="absolute top-4 right-4 z-10 bg-gradient-to-r from-red-600 to-pink-600 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
                    <Video className="w-3.5 h-3.5" />
                    {displayEvent.videos.length}
                </div>
            )}

            <div
                onClick={handleClick}
                className="bg-gradient-to-br from-white to-slate-50 rounded-3xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer hover:shadow-xl hover:border-purple-200 transition-all duration-500 hover:-translate-y-1 h-full flex flex-col"
            >
                {/* Image */}
                <div className="relative h-56 overflow-hidden">
                    <img
                        src={imageUrl}
                        alt={displayEvent.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = 'https://images.unsplash.com/photo-1540555700478-4be29ab4cb3d?q=80&w=600&h=400&fit=crop';
                        }}
                    />

                    {/* Overlay dégradé */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                    {/* Badge catégorie */}
                    <span className="absolute top-3 right-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
                        {displayEvent.category}
                    </span>

                    {/* Invités */}
                    {displayEvent.guests && (
                        <span className="absolute bottom-3 right-3 bg-white/20 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-white/30 shadow-lg">
                            <Users className="w-3.5 h-3.5" />
                            {displayEvent.guests}
                        </span>
                    )}

                    {/* Overlay hover avec CTA */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-purple-600/20">
                        <span className="bg-white text-purple-600 px-5 py-2.5 rounded-full font-bold shadow-xl transform scale-90 group-hover:scale-100 transition-transform duration-300 text-sm">
                            Voir les détails →
                        </span>
                    </div>
                </div>

                {/* Contenu */}
                <div className="p-5 flex-1 flex flex-col">
                    <h3 className="text-xl font-bold text-gray-900 mb-2 line-clamp-1 group-hover:text-purple-600 transition-colors duration-300">
                        {displayEvent.title}
                    </h3>

                    <p className="text-sm text-gray-600 mb-4 line-clamp-2 leading-relaxed flex-1">
                        {displayEvent.description}
                    </p>

                    <div className="space-y-2 text-sm text-gray-500 mb-4">
                        <div className="flex items-center gap-2">
                            <div className="p-1 rounded-lg bg-purple-50 flex-shrink-0">
                                <Calendar className="w-3.5 h-3.5 text-purple-600" />
                            </div>
                            <span className="font-medium text-gray-700">{formattedDate}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="p-1 rounded-lg bg-pink-50 flex-shrink-0">
                                <MapPin className="w-3.5 h-3.5 text-pink-600" />
                            </div>
                            <span className="line-clamp-1">{displayEvent.location}</span>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="pt-4 border-t border-gray-100 mt-auto">
                        <span className="inline-flex items-center text-sm font-semibold text-purple-600 group-hover:gap-2 transition-all">
                            Voir les détails
                            <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                        </span>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default EventCard;