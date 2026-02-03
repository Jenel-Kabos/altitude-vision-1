// src/pages/EventDetailPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Calendar, MapPin, Tag, ArrowLeft, Share2, Heart, Loader2, AlertCircle,
  ChevronLeft, ChevronRight, Send, Play, Image as ImageIcon, Video as VideoIcon,
  Users, Target, Lightbulb, Settings, TrendingUp
} from 'lucide-react';
import { getEventById } from '../services/eventService';
import { getFirstValidImage } from '../utils/imageUtils';
// Importation du nouveau composant CommentList
import CommentList from '../components/comments/CommentList';

const EventDetailPage = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [activeMediaTab, setActiveMediaTab] = useState('images');

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log('📡 [EventDetail] Chargement de l\'événement:', eventId);
        
        const data = await getEventById(eventId);
        setEvent(data);
        
        console.log('✅ [EventDetail] Événement chargé:', data);
      } catch (err) {
        console.error('❌ [EventDetail] Erreur:', err);
        setError('Impossible de charger les détails de l\'événement');
      } finally {
        setLoading(false);
      }
    };

    if (eventId) {
      fetchEvent();
    }
  }, [eventId]);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: event.name,
        text: event.description,
        url: window.location.href,
      });
    } else {
      setShowShareMenu(true);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('Lien copié dans le presse-papier !');
    setShowShareMenu(false);
  };

  const handlePreviousMedia = () => {
    const totalMedia = activeMediaTab === 'images' 
      ? (event.images?.length || 0) 
      : (event.videos?.length || 0);
    setCurrentMediaIndex((prev) => prev === 0 ? totalMedia - 1 : prev - 1);
  };

  const handleNextMedia = () => {
    const totalMedia = activeMediaTab === 'images' 
      ? (event.images?.length || 0) 
      : (event.videos?.length || 0);
    setCurrentMediaIndex((prev) => prev === totalMedia - 1 ? 0 : prev + 1);
  };

  // ✅ MODIFICATION : Redirection vers MilaEventsPage avec modal
  const handleRequestQuote = () => {
    navigate('/mila-events', { 
      state: { 
        openQuoteModal: true, 
        service: event.name 
      } 
    });
  };

  const getVideoEmbedUrl = (url) => {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)?.[1];
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }
    if (url.includes('vimeo.com')) {
      const videoId = url.match(/vimeo\.com\/(\d+)/)?.[1];
      return videoId ? `https://player.vimeo.com/video/${videoId}` : null;
    }
    return url;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 text-xl">Chargement de l'événement...</p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-red-50 border-l-4 border-red-500 p-8 rounded-lg shadow-md max-w-md">
          <div className="flex items-center mb-4">
            <AlertCircle className="text-red-500 w-8 h-8 mr-3" />
            <h3 className="text-xl font-semibold text-red-800">Erreur</h3>
          </div>
          <p className="text-red-700 mb-6">{error || 'Événement introuvable'}</p>
          <button
            onClick={() => navigate('/mila-events')}
            className="inline-flex items-center text-blue-600 hover:text-blue-700 font-semibold"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Retour aux événements
          </button>
        </div>
      </div>
    );
  }

  const formattedDate = new Date(event.date).toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const validImages = event.images?.filter(img => img && img.length > 10) || [];
  const validVideos = event.videos?.filter(vid => vid && vid.length > 10) || [];
  
  const currentImage = validImages[currentMediaIndex] || getFirstValidImage(
    validImages,
    'https://images.unsplash.com/photo-1540555700478-4be29ab4cb3d?q=80&w=2070&auto=format&fit=crop'
  );
  const currentVideo = validVideos[currentMediaIndex];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Bouton retour */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4">
          <button
            onClick={() => navigate('/mila-events')}
            className="flex items-center text-gray-600 hover:text-blue-600 transition font-semibold"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Retour aux événements
          </button>
        </div>
      </div>

      <div className="container mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Galerie mixte (images + vidéos) */}
          <div className="space-y-6">
            {/* Onglets Images / Vidéos */}
            {validVideos.length > 0 && (
              <div className="flex gap-2 bg-white p-2 rounded-xl shadow-md">
                <button
                  onClick={() => {
                    setActiveMediaTab('images');
                    setCurrentMediaIndex(0);
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-semibold transition ${
                    activeMediaTab === 'images'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <ImageIcon className="w-5 h-5" />
                  Images ({validImages.length})
                </button>
                <button
                  onClick={() => {
                    setActiveMediaTab('videos');
                    setCurrentMediaIndex(0);
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-semibold transition ${
                    activeMediaTab === 'videos'
                      ? 'bg-red-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <VideoIcon className="w-5 h-5" />
                  Vidéos ({validVideos.length})
                </button>
              </div>
            )}

            {/* Affichage du média principal */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              className="relative h-96 lg:h-[500px] rounded-2xl overflow-hidden shadow-2xl group"
            >
              {activeMediaTab === 'images' ? (
                <img
                  src={currentImage}
                  alt={event.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.src = 'https://placehold.co/800x600/60A5FA/FFFFFF?text=Mila+Events';
                  }}
                />
              ) : (
                <div className="w-full h-full bg-black flex items-center justify-center">
                  {currentVideo && (
                    <>
                      {getVideoEmbedUrl(currentVideo)?.includes('youtube.com') || 
                       getVideoEmbedUrl(currentVideo)?.includes('vimeo.com') ? (
                        <iframe
                          src={getVideoEmbedUrl(currentVideo)}
                          className="w-full h-full"
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      ) : (
                        <video
                          src={currentVideo}
                          controls
                          className="w-full h-full"
                          controlsList="nodownload"
                        >
                          Votre navigateur ne supporte pas la lecture de vidéos.
                        </video>
                      )}
                    </>
                  )}
                </div>
              )}
              
              {/* Navigation */}
              {((activeMediaTab === 'images' && validImages.length > 1) || 
                (activeMediaTab === 'videos' && validVideos.length > 1)) && (
                <>
                  <button
                    onClick={handlePreviousMedia}
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 p-3 rounded-full shadow-lg hover:bg-white transition opacity-0 group-hover:opacity-100"
                  >
                    <ChevronLeft className="w-6 h-6 text-gray-800" />
                  </button>
                  <button
                    onClick={handleNextMedia}
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 p-3 rounded-full shadow-lg hover:bg-white transition opacity-0 group-hover:opacity-100"
                  >
                    <ChevronRight className="w-6 h-6 text-gray-800" />
                  </button>
                  
                  {/* Indicateurs */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                    {(activeMediaTab === 'images' ? validImages : validVideos).map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentMediaIndex(index)}
                        className={`w-3 h-3 rounded-full transition ${
                          index === currentMediaIndex
                            ? 'bg-white w-8'
                            : 'bg-white/50 hover:bg-white/75'
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </motion.div>

            {/* Miniatures */}
            {activeMediaTab === 'images' && validImages.length > 1 && (
              <div className="grid grid-cols-4 gap-4">
                {validImages.map((img, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentMediaIndex(index)}
                    className={`relative h-24 rounded-lg overflow-hidden shadow-md transition ${
                      index === currentMediaIndex
                        ? 'ring-4 ring-blue-500'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={img}
                      alt={`${event.name} ${index + 1}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.src = 'https://placehold.co/200x150/60A5FA/FFFFFF?text=Image';
                      }}
                    />
                  </button>
                ))}
              </div>
            )}

            {activeMediaTab === 'videos' && validVideos.length > 1 && (
              <div className="grid grid-cols-2 gap-4">
                {validVideos.map((video, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentMediaIndex(index)}
                    className={`relative h-24 rounded-lg overflow-hidden shadow-md transition flex items-center justify-center bg-gray-900 ${
                      index === currentMediaIndex
                        ? 'ring-4 ring-red-500'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    <Play className="w-8 h-8 text-white" />
                    <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                      Vidéo {index + 1}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Détails de l'événement */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-8"
          >
            {/* En-tête */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-bold">
                  <Tag className="w-4 h-4" />
                  {event.category || 'Événement'}
                </span>
                
                <div className="flex gap-2">
                  <button
                    onClick={handleShare}
                    className="p-3 bg-gray-100 rounded-full hover:bg-gray-200 transition"
                    title="Partager"
                  >
                    <Share2 className="w-5 h-5 text-gray-600" />
                  </button>
                  <button
                    className="p-3 bg-red-50 rounded-full hover:bg-red-100 transition"
                    title="Ajouter aux favoris"
                  >
                    <Heart className="w-5 h-5 text-red-500" />
                  </button>
                </div>
              </div>
              
              <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 mb-6">
                {event.name}
              </h1>
              
              {/* Informations clés */}
              <div className="space-y-4 bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-2xl border border-blue-100">
                <div className="flex items-center text-gray-700">
                  <Calendar className="w-6 h-6 mr-4 text-blue-600" />
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Date</p>
                    <p className="text-lg font-bold">{formattedDate}</p>
                  </div>
                </div>
                
                <div className="flex items-center text-gray-700">
                  <MapPin className="w-6 h-6 mr-4 text-red-600" />
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Lieu</p>
                    <p className="text-lg font-bold">{event.location}</p>
                  </div>
                </div>

                {/* Nombre d'invités */}
                {event.guests && (
                  <div className="flex items-center text-gray-700">
                    <Users className="w-6 h-6 mr-4 text-purple-600" />
                    <div>
                      <p className="text-sm text-gray-500 font-medium">Participants</p>
                      <p className="text-lg font-bold">{event.guests} invités</p>
                    </div>
                  </div>
                )}

                {/* Compteurs de médias */}
                <div className="flex gap-4 pt-4 border-t border-blue-200">
                  <div className="flex items-center gap-2 text-blue-600">
                    <ImageIcon className="w-5 h-5" />
                    <span className="font-semibold">{validImages.length} image{validImages.length > 1 ? 's' : ''}</span>
                  </div>
                  {validVideos.length > 0 && (
                    <div className="flex items-center gap-2 text-red-600">
                      <VideoIcon className="w-5 h-5" />
                      <span className="font-semibold">{validVideos.length} vidéo{validVideos.length > 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Description</h2>
              <p className="text-gray-600 text-lg leading-relaxed whitespace-pre-wrap">
                {event.description}
              </p>
              
              {event.about && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="text-xl font-bold text-gray-800 mb-3">À propos</h3>
                  <p className="text-gray-600 text-lg leading-relaxed">
                    {event.about}
                  </p>
                </div>
              )}
              
              {event.missions && event.missions.length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="text-xl font-bold text-gray-800 mb-3">Nos missions</h3>
                  <ul className="space-y-2">
                    {event.missions.map((mission, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-blue-500 mr-3 mt-1">✓</span>
                        <span className="text-gray-600 text-lg">{mission}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* NOUVEAUX DÉTAILS DE L'ÉVÉNEMENT */}
            {(event.objective || event.creativeConcept || event.realization || event.result) && (
              <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 space-y-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 pb-4 border-b-2 border-blue-500">
                  Détails de l'Événement
                </h2>

                {/* Objectif */}
                {event.objective && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-100 p-3 rounded-xl">
                        <Target className="w-6 h-6 text-blue-600" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-800">Objectif</h3>
                    </div>
                    <p className="text-gray-600 text-lg leading-relaxed pl-14">
                      {event.objective}
                    </p>
                  </div>
                )}

                {/* Concept Créatif */}
                {event.creativeConcept && (
                  <div className="space-y-3 pt-6 border-t border-gray-200">
                    <div className="flex items-center gap-3">
                      <div className="bg-yellow-100 p-3 rounded-xl">
                        <Lightbulb className="w-6 h-6 text-yellow-600" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-800">Concept Créatif</h3>
                    </div>
                    <p className="text-gray-600 text-lg leading-relaxed pl-14 whitespace-pre-wrap">
                      {event.creativeConcept}
                    </p>
                  </div>
                )}

                {/* Réalisation & Scénographie */}
                {event.realization && (
                  <div className="space-y-3 pt-6 border-t border-gray-200">
                    <div className="flex items-center gap-3">
                      <div className="bg-green-100 p-3 rounded-xl">
                        <Settings className="w-6 h-6 text-green-600" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-800">Réalisation & Scénographie</h3>
                    </div>
                    <p className="text-gray-600 text-lg leading-relaxed pl-14 whitespace-pre-wrap">
                      {event.realization}
                    </p>
                  </div>
                )}

                {/* Résultat */}
                {event.result && (
                  <div className="space-y-3 pt-6 border-t border-gray-200">
                    <div className="flex items-center gap-3">
                      <div className="bg-purple-100 p-3 rounded-xl">
                        <TrendingUp className="w-6 h-6 text-purple-600" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-800">Résultat</h3>
                    </div>
                    <p className="text-gray-600 text-lg leading-relaxed pl-14 whitespace-pre-wrap">
                      {event.result}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Call to Action */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-8 rounded-2xl shadow-xl text-white">
              <h3 className="text-2xl font-bold mb-3">Intéressé par cet événement ?</h3>
              <p className="mb-6 text-blue-100">
                Contactez-nous pour organiser un événement similaire ou pour plus d'informations.
              </p>
              <motion.button
                onClick={handleRequestQuote}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-full flex items-center justify-center gap-3 bg-white text-blue-600 font-bold py-4 px-6 rounded-xl shadow-lg hover:bg-blue-50 transition"
              >
                <Send className="w-6 h-6" />
                Demander un Devis
              </motion.button>
            </div>
          </motion.div>
        </div>

        {/* SECTION COMMENTAIRES AJOUTÉE ICI */}
        <div className="mt-16 pt-8 border-t border-gray-200">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">💬 Commentaires</h2>
            <CommentList targetType="Event" targetId={event._id} />
        </div>
        {/* FIN SECTION COMMENTAIRES */}

      </div>

      {/* Menu de partage */}
      {showShareMenu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl"
          >
            <h3 className="text-xl font-bold mb-4">Partager cet événement</h3>
            <div className="space-y-3">
              <button
                onClick={copyLink}
                className="w-full text-left px-4 py-3 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
              >
                📋 Copier le lien
              </button>
              <button
                onClick={() => setShowShareMenu(false)}
                className="w-full px-4 py-3 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition font-semibold"
              >
                Fermer
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default EventDetailPage;