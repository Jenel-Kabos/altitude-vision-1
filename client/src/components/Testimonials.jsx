import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Star, ChevronLeft, ChevronRight, Quote } from 'lucide-react';
import api from '../services/api';

const Testimonials = () => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      console.log('🔍 [Testimonials] Chargement des avis...');
      
      const response = await api.get('/reviews', {
        params: {
          limit: 10,
          sort: '-createdAt'
        }
      });

      console.log('📦 [Testimonials] Réponse complète:', response);
      console.log('📦 [Testimonials] response.data:', response.data);

      // ✅ Gestion robuste des différents formats de réponse
      let reviewsData = [];

      if (Array.isArray(response.data)) {
        // Format 1: response.data = [...]
        console.log('✅ [Testimonials] Format: Array direct');
        reviewsData = response.data;
      } else if (response.data.data && Array.isArray(response.data.data)) {
        // Format 2: response.data.data = [...]
        console.log('✅ [Testimonials] Format: response.data.data (Array)');
        reviewsData = response.data.data;
      } else if (response.data.data && response.data.data.reviews && Array.isArray(response.data.data.reviews)) {
        // Format 3: response.data.data.reviews = [...]
        console.log('✅ [Testimonials] Format: response.data.data.reviews');
        reviewsData = response.data.data.reviews;
      } else if (response.data.reviews && Array.isArray(response.data.reviews)) {
        // Format 4: response.data.reviews = [...]
        console.log('✅ [Testimonials] Format: response.data.reviews');
        reviewsData = response.data.reviews;
      } else {
        // Recherche intelligente
        console.warn('⚠️ [Testimonials] Format non standard:', response.data);
        
        if (response.data.data && typeof response.data.data === 'object') {
          const arrays = Object.entries(response.data.data).filter(([key, value]) => Array.isArray(value));
          if (arrays.length > 0) {
            const [key, value] = arrays[0];
            console.log(`✅ [Testimonials] Tableau trouvé: ${key}`);
            reviewsData = value;
          }
        } else if (response.data && typeof response.data === 'object') {
          const arrays = Object.entries(response.data).filter(([key, value]) => Array.isArray(value));
          if (arrays.length > 0) {
            const [key, value] = arrays[0];
            console.log(`✅ [Testimonials] Tableau trouvé: ${key}`);
            reviewsData = value;
          }
        }
      }

      // ✅ Vérification finale
      if (!Array.isArray(reviewsData)) {
        console.error('❌ [Testimonials] reviewsData n\'est pas un tableau:', reviewsData);
        reviewsData = [];
      }

      console.log('✅ [Testimonials] Avis chargés:', reviewsData.length);
      
      // Filtrer pour avoir des avis avec au moins 4 étoiles
      const topReviews = reviewsData.filter(r => r.rating >= 4);
      console.log('⭐ [Testimonials] Avis 4+ étoiles:', topReviews.length);
      
      setReviews(topReviews);
    } catch (error) {
      console.error('❌ [Testimonials] Erreur:', error);
      setReviews([]);
    } finally {
      setLoading(false);
    }
  };

  const nextReview = () => {
    setCurrentIndex((prev) => (prev + 1) % reviews.length);
  };

  const prevReview = () => {
    setCurrentIndex((prev) => (prev - 1 + reviews.length) % reviews.length);
  };

  const renderStars = (rating) => {
    return (
      <div className="flex gap-1 justify-center mb-4">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={20}
            className={star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <section className="py-16 bg-gradient-to-b from-white to-slate-50">
        <div className="container mx-auto px-4 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-500 mt-4">Chargement des témoignages...</p>
        </div>
      </section>
    );
  }

  // ✅ CORRECTION : Vérification sécurisée avant d'accéder à .length
  if (!reviews || reviews.length === 0) {
    return (
      <section className="py-16 bg-gradient-to-b from-white to-slate-50">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Témoignages de Nos Clients
          </h2>
          <p className="text-gray-500">Aucun avis disponible pour le moment.</p>
        </div>
      </section>
    );
  }

  const currentReview = reviews[currentIndex];

  return (
    <section className="py-16 sm:py-20 bg-gradient-to-b from-white to-slate-50">
      <div className="container mx-auto px-4 sm:px-6 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <p className="text-xs sm:text-sm font-bold text-blue-600 uppercase tracking-wider mb-2">
            Témoignages
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-3">
            Ils Nous Font Confiance
          </h2>
          <p className="text-gray-500 text-base sm:text-lg">
            Découvrez l'expérience de nos clients satisfaits
          </p>
        </motion.div>

        <div className="relative">
          {/* Quote Icon */}
          <Quote className="absolute -top-4 -left-4 w-16 h-16 text-blue-100 opacity-50" />

          {/* Review Card */}
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ duration: 0.5 }}
            className="bg-white rounded-3xl shadow-xl p-8 sm:p-12 relative"
          >
            {/* Stars */}
            {renderStars(currentReview.rating)}

            {/* Comment */}
            <p className="text-gray-700 text-lg sm:text-xl leading-relaxed mb-6 text-center italic">
              "{currentReview.comment}"
            </p>

            {/* Author Info */}
            <div className="flex items-center justify-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                {currentReview.author?.photo ? (
                  <img
                    src={currentReview.author.photo}
                    alt={currentReview.author.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  currentReview.author?.name?.charAt(0).toUpperCase() || 'U'
                )}
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900">
                  {currentReview.author?.name || 'Utilisateur'}
                </p>
                <p className="text-sm text-gray-500">
                  {currentReview.pole}
                </p>
              </div>
            </div>

            {/* Admin Response (if exists) */}
            {currentReview.adminResponse && currentReview.adminResponse.text && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="bg-blue-50 rounded-2xl p-4">
                  <p className="text-sm font-semibold text-blue-900 mb-2">
                    Réponse de l'équipe Altitude-Vision
                  </p>
                  <p className="text-gray-700 text-sm italic">
                    {currentReview.adminResponse.text}
                  </p>
                </div>
              </div>
            )}
          </motion.div>

          {/* Navigation Buttons */}
          {reviews.length > 1 && (
            <div className="flex justify-center items-center gap-4 mt-8">
              <button
                onClick={prevReview}
                className="p-3 rounded-full bg-white shadow-lg hover:shadow-xl hover:bg-blue-50 transition-all duration-300 group"
                aria-label="Avis précédent"
              >
                <ChevronLeft className="w-6 h-6 text-gray-600 group-hover:text-blue-600" />
              </button>

              {/* Indicators */}
              <div className="flex gap-2">
                {reviews.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentIndex(index)}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      index === currentIndex
                        ? 'bg-blue-600 w-8'
                        : 'bg-gray-300 hover:bg-blue-400'
                    }`}
                    aria-label={`Aller à l'avis ${index + 1}`}
                  />
                ))}
              </div>

              <button
                onClick={nextReview}
                className="p-3 rounded-full bg-white shadow-lg hover:shadow-xl hover:bg-blue-50 transition-all duration-300 group"
                aria-label="Avis suivant"
              >
                <ChevronRight className="w-6 h-6 text-gray-600 group-hover:text-blue-600" />
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;