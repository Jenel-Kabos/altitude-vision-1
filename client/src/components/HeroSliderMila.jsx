import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const images = [
    {
        url:    'https://images.unsplash.com/photo-1735679356705-7c06b780c7a4?q=80&w=1460&auto=format&fit=crop',
        width:  1460,
        height: 973,
        title:  "Événement d'entreprise",
        subtitle: "Des moments professionnels inoubliables",
    },
    {
        url:    'https://i.pinimg.com/1200x/0a/a4/2f/0aa42fc9b1216c0c5f8ced31f5942b8d.jpg',
        width:  1200,
        height: 800,
        title:  'Mariage',
        subtitle: "Le plus beau jour de votre vie, sublimé",
    },
    {
        url:    'https://i.pinimg.com/736x/24/15/bb/2415bba840f23db5fcb6ca010d439b64.jpg',
        width:  736,
        height: 490,
        title:  'Décoration',
        subtitle: "Des ambiances sur mesure, avec élégance",
    },
];

const SLIDE_DURATION = 6000;

const HeroSliderMila = () => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [direction,    setDirection]    = useState(1);
    const [progress,     setProgress]    = useState(0);
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
    const prev = () => { setDirection(-1); setCurrentIndex(p => (p - 1 + images.length) % images.length); resetTimers(); };
    const next = () => { setDirection(1);  setCurrentIndex(p => (p + 1) % images.length); resetTimers(); };

    const slideVariants = {
        enter:  (dir) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0 }),
        center: { x: '0%', opacity: 1, transition: { duration: 0.65, ease: [0.25, 0.46, 0.45, 0.94] } },
        exit:   (dir) => ({ x: dir < 0 ? '100%' : '-100%', opacity: 0, transition: { duration: 0.55, ease: [0.55, 0, 1, 0.45] } }),
    };

    return (
        <div
            className="absolute inset-0 overflow-hidden"
            role="region"
            aria-label="Diaporama Mila Events"
            aria-roledescription="carousel"
        >
            <AnimatePresence initial={false} custom={direction} mode="wait">
                <motion.div
                    key={currentIndex}
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    className="absolute inset-0"
                    role="group"
                    aria-roledescription="diapositive"
                    aria-label={`${currentIndex + 1} sur ${images.length} : ${images[currentIndex].title}`}
                >
                    {/* ✅ <img> avec dimensions + fetchpriority → élimine layout shift et améliore LCP */}
                    <motion.div
                        className="w-full h-full relative"
                        initial={{ scale: 1.08 }}
                        animate={{ scale: 1.03 }}
                        transition={{ duration: SLIDE_DURATION / 1000, ease: 'linear' }}
                    >
                        <img
                            src={images[currentIndex].url}
                            alt={images[currentIndex].title}
                            width={images[currentIndex].width}
                            height={images[currentIndex].height}
                            fetchpriority={currentIndex === 0 ? 'high' : 'low'}
                            loading={currentIndex === 0 ? 'eager' : 'lazy'}
                            decoding={currentIndex === 0 ? 'sync' : 'async'}
                            style={{
                                position:       'absolute',
                                inset:          0,
                                width:          '100%',
                                height:         '100%',
                                objectFit:      'cover',
                                objectPosition: 'center',
                            }}
                        />
                        {/* Dégradé dramatique – palette Mila Events */}
                        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/30 via-black/40 to-black/75" />
                    </motion.div>
                </motion.div>
            </AnimatePresence>

            {/* Bouton Gauche */}
            <button
                onClick={prev}
                className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-white/15 hover:bg-white/35 backdrop-blur-md border border-white/20 transition-all duration-300 text-white shadow-2xl hover:scale-110 active:scale-95"
                aria-label="Image précédente"
                style={{ minWidth: '44px', minHeight: '44px' }}
            >
                <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" aria-hidden="true" />
            </button>

            {/* Bouton Droite */}
            <button
                onClick={next}
                className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-white/15 hover:bg-white/35 backdrop-blur-md border border-white/20 transition-all duration-300 text-white shadow-2xl hover:scale-110 active:scale-95"
                aria-label="Image suivante"
                style={{ minWidth: '44px', minHeight: '44px' }}
            >
                <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" aria-hidden="true" />
            </button>

            {/* Indicateurs */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-3">
                <div
                    className="w-28 h-0.5 bg-white/25 rounded-full overflow-hidden"
                    role="progressbar"
                    aria-valuenow={Math.round(progress)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Progression"
                >
                    <div
                        className="h-full bg-gradient-to-r from-purple-400 to-pink-400 rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                <div className="flex items-center gap-2.5" role="tablist" aria-label="Diapositives">
                    {images.map((img, i) => (
                        <button
                            key={i}
                            onClick={() => goTo(i)}
                            role="tab"
                            aria-selected={i === currentIndex}
                            aria-label={`Aller à : ${img.title}`}
                            style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                            <span className={`block rounded-full transition-all duration-400 ${
                                i === currentIndex
                                    ? 'w-8 h-2.5 bg-white shadow-lg shadow-white/30'
                                    : 'w-2.5 h-2.5 bg-white/40 hover:bg-white/65'
                            }`} />
                        </button>
                    ))}
                </div>
            </div>

            <div
                className="absolute top-6 right-6 z-20 text-white/50 text-sm font-light tracking-widest select-none pointer-events-none"
                aria-hidden="true"
            >
                {String(currentIndex + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}
            </div>
        </div>
    );
};

export default HeroSliderMila;