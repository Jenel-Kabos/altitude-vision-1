import React, { useEffect, useState } from "react";
import Slider from "react-slick";
import { motion } from "framer-motion";
import { Quote, Loader2, MessageSquarePlus, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getAllTestimonials } from "../services/reviewService"; // ✅ Service review
import { useAuth } from "../context/AuthContext";

const Testimonials = () => {
  const [testimonials, setTestimonials] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // ✅ Hooks pour le bouton intelligent
  const { user } = useAuth();
  const navigate = useNavigate();

  // 1. Récupération des données dynamiques - TOUS les avis de TOUS les pôles
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        console.log('🔍 [Testimonials] Chargement des avis...');
        const data = await getAllTestimonials(10); // Récupère 10 avis max
        
        console.log('📦 [Testimonials] Données reçues:', data);
        console.log('📦 [Testimonials] Type:', Array.isArray(data) ? 'Array' : typeof data);
        console.log('📦 [Testimonials] Nombre d\'avis:', Array.isArray(data) ? data.length : 'N/A');
        
        // ✅ CORRECTION : Vérification que data est bien un tableau
        if (Array.isArray(data)) {
          setTestimonials(data);
          console.log('✅ [Testimonials] Avis chargés avec succès:', data.length);
        } else {
          console.error('❌ [Testimonials] data n\'est pas un tableau:', data);
          setTestimonials([]);
          setError('Format de données incorrect');
        }
      } catch (error) {
        console.error("❌ [Testimonials] Erreur chargement témoignages:", error);
        setTestimonials([]);
        setError('Impossible de charger les avis');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // ✅ Fonction du bouton intelligent
  const handleLeaveReview = () => {
    if (user) {
      // Si connecté -> On va direct à la page de création
      navigate('/avis/nouveau');
    } else {
      // Si pas connecté -> Login, puis redirection automatique vers les avis
      navigate('/login', { state: { from: '/avis/nouveau' } });
    }
  };

  const settings = {
    dots: true,
    infinite: testimonials.length > 1,  // ✅ Infinite seulement si plus d'1 avis
    speed: 800,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: testimonials.length > 1,  // ✅ Autoplay seulement si plus d'1 avis
    autoplaySpeed: 5000,
    arrows: false,
    appendDots: dots => (
      <div style={{ bottom: "-40px" }}>
        <ul className="m-0 p-0"> {dots} </ul>
      </div>
    ),
    customPaging: i => (
      <div className="w-3 h-3 bg-gray-600 rounded-full hover:bg-blue-500 transition-colors duration-300 mx-1"></div>
    )
  };

  // ✅ État de chargement
  if (isLoading) {
    return (
      <section className="py-24 bg-gray-900 flex justify-center items-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
          <p className="text-gray-400 animate-pulse">Chargement des avis...</p>
        </div>
      </section>
    );
  }

  // ✅ État d'erreur
  if (error) {
    return (
      <section className="py-24 bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold mb-4 text-red-400">
            Erreur de chargement
          </h2>
          <p className="text-gray-400 mb-8">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-full transition-colors"
          >
            Réessayer
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="py-24 bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white relative overflow-hidden">
      {/* Halo animé global en fond */}
      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_20%,#2563eb_0%,transparent_40%),radial-gradient(circle_at_70%_80%,#7c3aed_0%,transparent_40%)] animate-pulse-slow pointer-events-none"></div>

      <div className="container mx-auto px-6 md:px-12 lg:px-24 relative z-10">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl md:text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500 mb-4">
            Ce que disent nos clients
          </h2>
          <div className="h-1 w-24 bg-gradient-to-r from-blue-500 to-indigo-600 mx-auto rounded-full"></div>
        </motion.div>

        {/* ✅ VÉRIFICATION SÉCURISÉE avant .length */}
        {testimonials && testimonials.length > 0 ? (
          <Slider {...settings}>
            {testimonials.map((t, index) => (
              <div key={t._id || index} className="outline-none">
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8 }}
                  className="flex flex-col items-center text-center px-4 md:px-20 relative py-4"
                >
                  {/* Halo individuel */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full blur-3xl opacity-20 animate-pulse-slow pointer-events-none"></div>

                  <motion.div
                    className="relative mb-8 group cursor-pointer"
                    whileHover={{ scale: 1.05 }}
                    transition={{ type: "spring", stiffness: 200 }}
                  >
                    <div className="relative">
                      {/* ✅ Utilise author.name au lieu de t.name */}
                      <img
                        src={t.author?.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(t.author?.name || 'Client')}&background=1e293b&color=fff`}
                        alt={t.author?.name || 'Client'}
                        className="w-28 h-28 md:w-32 md:h-32 rounded-full object-cover shadow-2xl border-4 border-gray-800 relative z-10 bg-gray-800"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(t.author?.name || 'Client')}&background=1e293b&color=fff`;
                        }}
                      />
                      <motion.div 
                        className="absolute -bottom-3 -right-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-2.5 rounded-full shadow-lg z-20 border-4 border-gray-900"
                        whileHover={{ rotate: 15 }}
                      >
                        <Quote size={18} fill="currentColor" />
                      </motion.div>
                    </div>
                  </motion.div>

                  {/* Note en étoiles */}
                  {t.rating && (
                    <div className="flex gap-1 mb-4">
                      {[...Array(5)].map((_, i) => (
                        <Star 
                          key={i} 
                          size={16} 
                          className={i < t.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-600"} 
                        />
                      ))}
                    </div>
                  )}

                  {/* Badge du pôle */}
                  {t.pole && (
                    <span className="inline-block px-4 py-1 mb-4 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      {t.pole}
                    </span>
                  )}

                  {/* ✅ Utilise comment au lieu de review/message */}
                  <motion.blockquote
                    className="text-lg md:text-xl italic text-gray-300 leading-relaxed mb-8 max-w-3xl relative z-10"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                  >
                    "{t.comment}"
                  </motion.blockquote>

                  <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                    className="relative z-10 flex flex-col items-center"
                  >
                    {/* ✅ Utilise author.name */}
                    <h4 className="font-bold text-xl text-white tracking-wide">
                      {t.author?.name || 'Client'}
                    </h4>
                    <span className="text-sm font-medium text-blue-400 uppercase tracking-wider mt-1 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                      Client {t.pole}
                    </span>
                  </motion.div>

                  {/* ✅ Affichage de la réponse admin si elle existe */}
                  {t.adminResponse && t.adminResponse.text && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, delay: 0.5 }}
                      className="mt-8 max-w-2xl relative z-10"
                    >
                      <div className="bg-gradient-to-br from-blue-900/30 to-indigo-900/30 border border-blue-500/30 rounded-2xl p-6 backdrop-blur-sm">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="p-2 bg-blue-500/20 rounded-full">
                            <MessageSquarePlus className="w-4 h-4 text-blue-400" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-blue-300">
                              Réponse de l'équipe Altitude-Vision
                            </p>
                            <p className="text-xs text-gray-400">
                              {new Date(t.adminResponse.respondedAt).toLocaleDateString('fr-FR')}
                            </p>
                          </div>
                        </div>
                        <p className="text-gray-300 leading-relaxed italic">
                          {t.adminResponse.text}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              </div>
            ))}
          </Slider>
        ) : (
          <div className="text-center py-10">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-800 mb-6">
              <Star className="w-10 h-10 text-gray-600" />
            </div>
            <p className="text-gray-400 text-lg mb-2">Aucun avis disponible</p>
            <p className="text-gray-500 text-sm">Soyez le premier à partager votre expérience !</p>
          </div>
        )}

        {/* ✅ BOUTON INTELLIGENT */}
        <div className="text-center mt-20 relative z-10">
          <div className="flex flex-col items-center gap-3">
            <button 
              onClick={handleLeaveReview} 
              className="group relative inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full font-semibold shadow-lg shadow-blue-900/50 hover:shadow-blue-600/50 transition-all duration-300 hover:-translate-y-1 overflow-hidden"
            >
              {/* Effet brillance au survol */}
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
              
              <MessageSquarePlus className="w-5 h-5 relative z-10" />
              <span className="relative z-10">Laisser un avis</span>
            </button>
            
            {!user && (
              <p className="text-xs text-gray-500">
                (Connexion requise)
              </p>
            )}
          </div>
        </div>
      </div>
      
      <style>{`
        .slick-dots li { margin: 0 2px; }
        .slick-dots li button:before { display: none; }
        .slick-dots li.slick-active div { background-color: #3b82f6; transform: scale(1.2); }
        
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.3; }
        }
        
        .animate-pulse-slow {
          animation: pulse-slow 4s ease-in-out infinite;
        }
      `}</style>
    </section>
  );
};

export default Testimonials;