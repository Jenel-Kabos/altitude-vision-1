import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const images = [
    {
        url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=1175&auto=format&fit=crop',
        title: 'Propriété Moderne',
        subtitle: 'Architecture contemporaine et élégance',
    },
    {
        url: 'https://images.unsplash.com/photo-1658280024253-34cafdfbb002?q=80&w=1460&auto=format&fit=crop',
        title: 'Maison de Campagne Élégante',
        subtitle: 'Sérénité et charme à la française',
    },
    {
        url: 'https://i.pinimg.com/1200x/e0/ad/58/e0ad58febdde5afba13764a51d507246.jpg',
        title: 'Villa Suburbaine',
        subtitle: 'Luxe, espace et cadre de vie privilégié',
    },
];

const SLIDE_DURATION = 6000;

const HeroSliderAlt = () => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [direction, setDirection] = useState(1);
    const [progress, setProgress] = useState(0);
    const timerRef = useRef(null);
    const progressRef = useRef(null);

    const resetTimers = useCallback(() => {
        clearInterval(timerRef.current);
        clearInterval(progressRef.current);
        setProgress(0);

        timerRef.current = setInterval(() => {
            setDirection(1);
            setCurrentIndex(prev => (prev + 1) % images.length);
            setProgress(0);
        }, SLIDE_DURATION);

        progressRef.current = setInterval(() => {
            setProgress(prev => (prev >= 100 ? 0 : prev + 100 / (SLIDE_DURATION / 50)));
        }, 50);
    }, []);

    useEffect(() => {
        resetTimers();
        return () => {
            clearInterval(timerRef.current);
            clearInterval(progressRef.current);
        };
    }, [resetTimers]);

    const goTo = (index) => {
        setDirection(index > currentIndex ? 1 : -1);
        setCurrentIndex(index);
        resetTimers();
    };

    const prev = () => {
        setDirection(-1);
        setCurrentIndex(prev => (prev - 1 + images.length) % images.length);
        resetTimers();
    };

    const next = () => {
        setDirection(1);
        setCurrentIndex(prev => (prev + 1) % images.length);
        resetTimers();
    };

    const slideVariants = {
        enter: (dir) => ({
            x: dir > 0 ? '100%' : '-100%',
            opacity: 0,
        }),
        center: {
            x: '0%',
            opacity: 1,
            transition: { duration: 0.65, ease: [0.25, 0.46, 0.45, 0.94] },
        },
        exit: (dir) => ({
            x: dir < 0 ? '100%' : '-100%',
            opacity: 0,
            transition: { duration: 0.55, ease: [0.55, 0, 1, 0.45] },
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
                    {/* Image avec effet Ken Burns animé */}
                    <motion.div
                        className="w-full h-full bg-cover bg-center"
                        style={{ backgroundImage: `url(${images[currentIndex].url})` }}
                        initial={{ scale: 1.08 }}
                        animate={{ scale: 1.03 }}
                        transition={{ duration: SLIDE_DURATION / 1000, ease: 'linear' }}
                    >
                        {/* Dégradé doux – palette Altimmo bleue */}
                        <div className="absolute inset-0 bg-gradient-to-b from-blue-900/25 via-black/35 to-black/70" />
                    </motion.div>
                </motion.div>
            </AnimatePresence>

            {/* Bouton Gauche */}
            <button
                onClick={prev}
                className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-white/15 hover:bg-white/35 backdrop-blur-md border border-white/20 transition-all duration-300 text-white shadow-2xl hover:scale-110 active:scale-95"
                aria-label="Image précédente"
            >
                <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            {/* Bouton Droite */}
            <button
                onClick={next}
                className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-white/15 hover:bg-white/35 backdrop-blur-md border border-white/20 transition-all duration-300 text-white shadow-2xl hover:scale-110 active:scale-95"
                aria-label="Image suivante"
            >
                <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            {/* Indicateurs en bas */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-3">
                {/* Barre de progression */}
                <div className="w-28 h-0.5 bg-white/25 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-blue-400 to-sky-300 rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                {/* Dots */}
                <div className="flex items-center gap-2.5">
                    {images.map((img, i) => (
                        <button
                            key={i}
                            onClick={() => goTo(i)}
                            aria-label={`Aller à ${img.title}`}
                            className={`rounded-full transition-all duration-400 ${
                                i === currentIndex
                                    ? 'w-8 h-2.5 bg-white shadow-lg shadow-white/30'
                                    : 'w-2.5 h-2.5 bg-white/40 hover:bg-white/65'
                            }`}
                        />
                    ))}
                </div>
            </div>

            {/* Numéro de slide discret */}
            <div className="absolute top-6 right-6 z-20 text-white/50 text-sm font-light tracking-widest select-none pointer-events-none">
                {String(currentIndex + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}
            </div>
        </div>
    );
};

export default HeroSliderAlt;