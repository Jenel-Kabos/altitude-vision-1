import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

const slides = [
  {
    title: "Trouvez le bien idéal avec Altimmo",
    subtitle: "Achat, vente, location — nous réalisons vos projets immobiliers",
    image: "https://images.unsplash.com/photo-1507089947368-19c1da9775ae?auto=format&fit=crop&w=1600&q=80",
    button: "/altimmo",
  },
  {
    title: "Organisez vos événements avec MilaEvents",
    subtitle: "Mariages, galas, conférences — nous sublimons vos idées",
    image: "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    button: "/mila-events",
  },
  {
    title: "Boostez votre image avec Altcom",
    subtitle: "Communication, design & visibilité — faites la différence",
    image: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    button: "/altcom",
  },
];

const SLIDE_DURATION = 7000; // Durée entre chaque slide (ms)

const HeroSlider = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [progress, setProgress] = useState(0);

  // Fonction pour passer à la slide suivante
  const nextSlide = () => {
    setDirection(1);
    setCurrentIndex((prevIndex) => (prevIndex + 1) % slides.length);
    setProgress(0);
  };

  // Fonction pour passer à la slide précédente
  const prevSlide = () => {
    setDirection(-1);
    setCurrentIndex((prevIndex) => (prevIndex - 1 + slides.length) % slides.length);
    setProgress(0);
  };

  // Fonction pour aller directement à une slide
  const goToSlide = (index) => {
    setDirection(index > currentIndex ? 1 : -1);
    setCurrentIndex(index);
    setProgress(0);
  };

  // Auto-défilement + barre de progression
  useEffect(() => {
    const interval = setInterval(nextSlide, SLIDE_DURATION);
    const progressInterval = setInterval(() => {
      setProgress((prev) => (prev >= 100 ? 0 : prev + 1));
    }, SLIDE_DURATION / 100);

    return () => {
      clearInterval(interval);
      clearInterval(progressInterval);
    };
  }, []);

  // Variants d'animation - style HeroSliderAlt
  const slideVariants = {
    enter: (direction) => ({
      x: direction > 0 ? '100%' : '-100%',
      opacity: 0,
    }),
    center: {
      x: '0%',
      opacity: 1,
      transition: { duration: 0.6, ease: "easeOut" },
    },
    exit: (direction) => ({
      x: direction < 0 ? '100%' : '-100%',
      opacity: 0,
      transition: { duration: 0.5, ease: "easeIn" },
    }),
  };

  return (
    <div className="absolute inset-0 overflow-hidden">
      <AnimatePresence initial={false} custom={direction} mode="wait">
        <motion.div
          key={currentIndex}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          className="absolute inset-0"
        >
          {/* Image de fond avec effet Ken Burns */}
          <motion.div
            className="w-full h-full bg-cover bg-center"
            style={{
              backgroundImage: `url(${slides[currentIndex].image})`,
              transform: 'scale(1.05)',
            }}
            initial={{ scale: 1.1 }}
            animate={{ scale: 1.05 }}
            transition={{ duration: SLIDE_DURATION / 1000, ease: "easeOut" }}
          >
            {/* Overlay sombre - style cohérent avec HeroSliderAlt */}
            <div className="absolute inset-0 bg-gray-900/60"></div>
          </motion.div>

          {/* Contenu texte avec animations */}
          <div className="absolute inset-0 flex flex-col justify-center items-center text-center text-white px-6 z-10">
            <motion.h2
              key={`title-${currentIndex}`}
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-3xl md:text-5xl lg:text-6xl font-bold mb-4 drop-shadow-lg tracking-tight"
            >
              {slides[currentIndex].title}
            </motion.h2>

            <motion.p
              key={`subtitle-${currentIndex}`}
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="text-lg md:text-xl lg:text-2xl mb-8 opacity-90 max-w-2xl font-light"
            >
              {slides[currentIndex].subtitle}
            </motion.p>

            <motion.a
              href={slides[currentIndex].button}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="group inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white py-3 px-8 rounded-full font-semibold shadow-2xl hover:shadow-blue-500/50 transition-all duration-300 hover:scale-105"
            >
              Découvrir
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </motion.a>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Boutons de navigation - style moderne cohérent */}
      <button
        onClick={prevSlide}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur-sm transition-all text-white shadow-xl"
        aria-label="Image précédente"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>

      <button
        onClick={nextSlide}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur-sm transition-all text-white shadow-xl"
        aria-label="Image suivante"
      >
        <ChevronRight className="w-6 h-6" />
      </button>

      {/* Indicateurs en bas - design épuré */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex flex-col items-center space-y-3 z-20">
        {/* Barre de progression */}
        <div className="w-32 h-1 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
          <motion.div
            className="h-full bg-gradient-to-r from-blue-500 to-sky-400"
            initial={{ width: "0%" }}
            animate={{ width: `${progress}%` }}
            transition={{ ease: "linear" }}
          />
        </div>

        {/* Points indicateurs */}
        <div className="flex space-x-3">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => goToSlide(i)}
              className={`h-2.5 rounded-full transition-all duration-300 ${
                i === currentIndex
                  ? "bg-white w-8 shadow-lg"
                  : "bg-white/40 hover:bg-white/70 w-2.5"
              }`}
              aria-label={`Aller à la slide ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default HeroSlider;