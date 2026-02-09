import React, { useEffect, useState } from "react";
import Slider from "react-slick";
import { motion } from "framer-motion";
import { Quote, Loader2, MessageSquarePlus, Star } from "lucide-react";
import { useNavigate } from "react-router-dom"; // ✅ Import nécessaire pour la redirection
import { getAllTestimonials } from "../services/testimonialService"; // Vérifie ton chemin
import { useAuth } from "../context/AuthContext"; // ✅ Import du contexte Auth

const Testimonials = () => {
  const [testimonials, setTestimonials] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // ✅ Hooks pour le bouton intelligent
  const { user } = useAuth();
  const navigate = useNavigate();

  // 1. Récupération des données dynamiques
  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getAllTestimonials();
        setTestimonials(data);
      } catch (error) {
        console.error("Erreur chargement témoignages:", error);
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
    infinite: true,
    speed: 800,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
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

        {testimonials.length > 0 ? (
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
                      <img
                        src={t.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(t.name)}&background=1e293b&color=fff`}
                        alt={t.name}
                        className="w-28 h-28 md:w-32 md:h-32 rounded-full object-cover shadow-2xl border-4 border-gray-800 relative z-10 bg-gray-800"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(t.name)}&background=1e293b&color=fff`;
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

                  {/* Note en étoiles (Optionnel si tu as le champ rating) */}
                  {t.rating && (
                    <div className="flex gap-1 mb-4">
                        {[...Array(5)].map((_, i) => (
                            <Star key={i} size={16} className={i < t.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-600"} />
                        ))}
                    </div>
                  )}

                  <motion.blockquote
                    className="text-lg md:text-xl italic text-gray-300 leading-relaxed mb-8 max-w-3xl relative z-10"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                  >
                    “{t.review || t.message}” {/* Supporte les deux noms de champs */}
                  </motion.blockquote>

                  <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                    className="relative z-10 flex flex-col items-center"
                  >
                    <h4 className="font-bold text-xl text-white tracking-wide">{t.name}</h4>
                    <span className="text-sm font-medium text-blue-400 uppercase tracking-wider mt-1 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                      {t.role || "Client"}
                    </span>
                  </motion.div>
                </motion.div>
              </div>
            ))}
          </Slider>
        ) : (
          <div className="text-center py-10">
            <p className="text-gray-400 text-lg">Soyez le premier à donner votre avis !</p>
          </div>
        )}

        {/* ✅ BOUTON INTELLIGENT (Modifié) */}
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
                    <p className="text-xs text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
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
      `}</style>
    </section>
  );
};

export default Testimonials;