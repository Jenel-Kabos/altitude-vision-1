import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const images = [
    { url: 'https://images.unsplash.com/photo-1735679356705-7c06b780c7a4?q=80&w=1460&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', title: 'Evenement d\'entreprise' },
    { url: 'https://i.pinimg.com/1200x/0a/a4/2f/0aa42fc9b1216c0c5f8ced31f5942b8d.jpg', title: 'Mariage' },
    { url: 'https://i.pinimg.com/736x/24/15/bb/2415bba840f23db5fcb6ca010d439b64.jpg', title: 'Décoration' },
];

const HeroSliderMila = () => {
    const [currentIndex, setCurrentIndex] = useState(0);

    // Fonction pour passer à l'image suivante (avec boucle)
    const nextSlide = () => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
    };

    // Fonction pour passer à l'image précédente (avec boucle)
    const prevSlide = () => {
        setCurrentIndex((prevIndex) => (prevIndex - 1 + images.length) % images.length);
    };

    // Auto-défilement toutes les 5 secondes
    useEffect(() => {
        const interval = setInterval(nextSlide, 5000);
        return () => clearInterval(interval);
    }, []);

    const slideVariants = {
        enter: (direction) => ({
            x: direction > 0 ? '100%' : '-100%',
            opacity: 0,
        }),
        center: {
            x: '0%',
            opacity: 1,
            transition: { duration: 0.5 },
        },
        exit: (direction) => ({
            x: direction < 0 ? '100%' : '-100%',
            opacity: 0,
            transition: { duration: 0.5 },
        }),
    };

    return (
        <div className="absolute inset-0 overflow-hidden">
            <AnimatePresence initial={false} custom={1}>
                <motion.div
                    key={currentIndex}
                    custom={1} // Direction vers l'avant (peut être dynamique si besoin)
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    className="absolute inset-0"
                >
                    <div 
                        className="w-full h-full bg-cover bg-center transition-all duration-1000 ease-in-out"
                        style={{ 
                            backgroundImage: `url(${images[currentIndex].url})`,
                            // Zoom subtil pour l'effet de profondeur
                            transform: 'scale(1.05)', 
                        }}
                    >
                        {/* Overlay sombre pour que le texte reste lisible */}
                        <div className="absolute inset-0 bg-gray-900/60"></div>
                    </div>
                </motion.div>
            </AnimatePresence>

            {/* Bouton de navigation Gauche */}
            <button
                onClick={prevSlide}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur-sm transition-all text-white shadow-xl"
                aria-label="Image précédente"
            >
                <ChevronLeft className="w-6 h-6" />
            </button>

            {/* Bouton de navigation Droite */}
            <button
                onClick={nextSlide}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur-sm transition-all text-white shadow-xl"
                aria-label="Image suivante"
            >
                <ChevronRight className="w-6 h-6" />
            </button>
        </div>
    );
};

export default HeroSliderMila;