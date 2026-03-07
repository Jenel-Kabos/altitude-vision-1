import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const GOLD      = '#C8872A';
const GOLD_LIGHT= '#E5A84B';
const BLUE      = '#2E7BB5';

const images = [
    {
        url: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
        title: 'Communication Digitale',
        subtitle: 'Des stratégies percutantes pour amplifier votre présence',
    },
    {
        url: 'https://plus.unsplash.com/premium_photo-1688821126516-aad66aa5510d?q=80&w=1976&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
        title: 'Branding & Design',
        subtitle: 'Des identités visuelles qui marquent les esprits',
    },
    {
        url: 'https://plus.unsplash.com/premium_photo-1710708584065-3aa4dec8271d?q=80&w=1332&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
        title: 'Couverture Médiatique',
        subtitle: 'Chaque moment capturé avec précision et élégance',
    },
];

const SLIDE_DURATION = 6000;

const HeroSliderAltcom = () => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [direction,    setDirection]    = useState(1);
    const [progress,     setProgress]     = useState(0);
    const timerRef    = useRef(null);
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
                    {/* Image Ken Burns */}
                    <motion.div
                        className="w-full h-full bg-cover bg-center"
                        style={{ backgroundImage: `url(${images[currentIndex].url})` }}
                        initial={{ scale: 1.08 }}
                        animate={{ scale: 1.03 }}
                        transition={{ duration: SLIDE_DURATION / 1000, ease: 'linear' }}
                    >
                        {/* Dégradé — palette Altcom or/sombre */}
                        <div className="absolute inset-0"
                            style={{
                                background: 'linear-gradient(to bottom, rgba(100,60,5,0.25) 0%, rgba(0,0,0,0.45) 40%, rgba(13,17,23,0.78) 100%)',
                            }} />
                    </motion.div>
                </motion.div>
            </AnimatePresence>

            {/* Bouton Gauche */}
            <button
                onClick={prev}
                className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full backdrop-blur-md border border-white/20 transition-all duration-300 text-white shadow-2xl hover:scale-110 active:scale-95"
                style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = `${GOLD}35`}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.12)'}
                aria-label="Image précédente"
            >
                <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            {/* Bouton Droite */}
            <button
                onClick={next}
                className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full backdrop-blur-md border border-white/20 transition-all duration-300 text-white shadow-2xl hover:scale-110 active:scale-95"
                style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = `${GOLD}35`}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.12)'}
                aria-label="Image suivante"
            >
                <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            {/* Indicateurs bas */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-3">

                {/* Barre de progression — or Altcom */}
                <div className="w-28 h-0.5 bg-white/20 rounded-full overflow-hidden">
                    <div
                        className="h-full rounded-full transition-all"
                        style={{
                            width:      `${progress}%`,
                            background: `linear-gradient(to right, ${GOLD}, ${GOLD_LIGHT})`,
                        }}
                    />
                </div>

                {/* Dots */}
                <div className="flex items-center gap-2.5">
                    {images.map((img, i) => (
                        <button
                            key={i}
                            onClick={() => goTo(i)}
                            aria-label={`Aller à ${img.title}`}
                            className="rounded-full transition-all duration-400"
                            style={{
                                width:      i === currentIndex ? '32px' : '10px',
                                height:     i === currentIndex ? '10px' : '10px',
                                background: i === currentIndex
                                    ? `linear-gradient(to right, ${GOLD}, ${GOLD_LIGHT})`
                                    : 'rgba(255,255,255,0.35)',
                                boxShadow:  i === currentIndex ? `0 2px 8px ${GOLD}60` : 'none',
                            }}
                        />
                    ))}
                </div>
            </div>

            {/* Compteur slide */}
            <div className="absolute top-6 right-6 z-20 text-sm font-light tracking-widest select-none pointer-events-none"
                style={{ color: `${GOLD}80`, fontFamily: "'Outfit', sans-serif" }}>
                {String(currentIndex + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}
            </div>
        </div>
    );
};

export default HeroSliderAltcom;