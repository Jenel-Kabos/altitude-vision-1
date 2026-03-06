import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import PropertyCard from './PropertyCard';
import EventCard from './EventCard';
import PortfolioCard from './PortfolioCard';

// ─────────────────────────────────────────────────────────────
// Couleurs par pôle — palette Altitude-Vision
// ─────────────────────────────────────────────────────────────
const POLE_COLORS = {
    property:  { primary: '#2E7BB5', shadow: 'rgba(46,123,181,0.3)' },   // Altimmo — bleu
    event:     { primary: '#D42B2B', shadow: 'rgba(212,43,43,0.3)' },    // Mila Events — rouge
    portfolio: { primary: '#C8872A', shadow: 'rgba(200,135,42,0.3)' },   // Altcom — or
};

// ─────────────────────────────────────────────────────────────
// Skeleton Card — affiché pendant le chargement
// ─────────────────────────────────────────────────────────────
const SkeletonCard = () => (
    <div className="animate-pulse bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 flex-shrink-0 w-full">
        <div className="bg-gray-200 h-56 w-full" />
        <div className="p-5 space-y-3">
            <div className="h-4 bg-gray-200 rounded-full w-3/4" />
            <div className="h-3 bg-gray-100 rounded-full w-full" />
            <div className="h-3 bg-gray-100 rounded-full w-2/3" />
            <div className="h-8 bg-gray-200 rounded-xl w-1/2 mt-4" />
        </div>
    </div>
);

// ─────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────
const HomeSlider = ({
    properties = [],
    isEvent     = false,
    isPortfolio = false,
    loading     = false,
    error       = null,
}) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [dragging, setDragging]         = useState(false);
    const dragStartX  = useRef(0);
    const dragDeltaX  = useRef(0);

    // ── Couleur active ──────────────────────
    const poleKey = isEvent ? 'event' : isPortfolio ? 'portfolio' : 'property';
    const colors  = POLE_COLORS[poleKey];

    // ── Nombre de cards visibles selon la largeur ──
    const getSlidesVisible = () => {
        if (typeof window === 'undefined') return 3;
        if (window.innerWidth < 640)  return 1;
        if (window.innerWidth < 1024) return 2;
        return 3;
    };
    const [slidesVisible, setSlidesVisible] = React.useState(getSlidesVisible);

    React.useEffect(() => {
        const onResize = () => setSlidesVisible(getSlidesVisible());
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const maxIndex = Math.max(0, properties.length - slidesVisible);

    // ── Navigation ──────────────────────────
    const prev = useCallback(() => {
        setCurrentIndex(i => Math.max(0, i - 1));
    }, []);

    const next = useCallback(() => {
        setCurrentIndex(i => Math.min(maxIndex, i + 1));
    }, [maxIndex]);

    const goTo = (index) => setCurrentIndex(Math.min(maxIndex, Math.max(0, index)));

    // ── Drag / Swipe ────────────────────────
    const onDragStart = (e) => {
        dragStartX.current = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
        dragDeltaX.current = 0;
        setDragging(true);
    };

    const onDragMove = (e) => {
        if (!dragging) return;
        const x = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
        dragDeltaX.current = x - dragStartX.current;
    };

    const onDragEnd = () => {
        if (!dragging) return;
        setDragging(false);
        if (dragDeltaX.current < -60) next();
        else if (dragDeltaX.current > 60) prev();
        dragDeltaX.current = 0;
    };

    // ── États vides / erreur / chargement ───
    if (loading) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-40 bg-red-50 rounded-3xl border border-red-100">
                <p className="text-red-600 font-medium text-sm">⚠️ {error}</p>
            </div>
        );
    }

    if (!properties || properties.length === 0) {
        return (
            <div className="flex items-center justify-center h-40 bg-slate-50 rounded-3xl border border-dashed border-gray-200">
                <p className="text-gray-400 italic text-sm">Aucune annonce disponible pour le moment.</p>
            </div>
        );
    }

    // ── Calcul de la largeur d'une card ─────
    const cardWidthPct = 100 / slidesVisible;

    return (
        <div className="relative">
            {/* ── Flèche gauche ────────────────────── */}
            <AnimatePresence>
                {currentIndex > 0 && (
                    <motion.button
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        onClick={prev}
                        aria-label="Précédent"
                        className="absolute -left-4 sm:-left-5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white shadow-lg border border-gray-100 flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
                        style={{ boxShadow: `0 4px 20px ${colors.shadow}` }}
                    >
                        <ChevronLeft className="w-5 h-5" style={{ color: colors.primary }} />
                    </motion.button>
                )}
            </AnimatePresence>

            {/* ── Flèche droite ────────────────────── */}
            <AnimatePresence>
                {currentIndex < maxIndex && (
                    <motion.button
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 8 }}
                        onClick={next}
                        aria-label="Suivant"
                        className="absolute -right-4 sm:-right-5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white shadow-lg border border-gray-100 flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
                        style={{ boxShadow: `0 4px 20px ${colors.shadow}` }}
                    >
                        <ChevronRight className="w-5 h-5" style={{ color: colors.primary }} />
                    </motion.button>
                )}
            </AnimatePresence>

            {/* ── Track des cards ──────────────────── */}
            <div
                className="overflow-hidden rounded-2xl cursor-grab active:cursor-grabbing"
                onMouseDown={onDragStart}
                onMouseMove={onDragMove}
                onMouseUp={onDragEnd}
                onMouseLeave={onDragEnd}
                onTouchStart={onDragStart}
                onTouchMove={onDragMove}
                onTouchEnd={onDragEnd}
            >
                <motion.div
                    className="flex"
                    animate={{ x: `-${currentIndex * cardWidthPct}%` }}
                    transition={{ type: 'spring', stiffness: 300, damping: 35 }}
                    style={{ width: `${(properties.length / slidesVisible) * 100}%` }}
                >
                    {properties.map((item, index) => (
                        <div
                            key={item._id || index}
                            className="px-2.5"
                            style={{ width: `${cardWidthPct / (properties.length / slidesVisible)}%` }}
                        >
                            {isEvent ? (
                                <EventCard event={item} index={index} />
                            ) : isPortfolio ? (
                                <PortfolioCard item={item} />
                            ) : (
                                <PropertyCard property={item} index={index} />
                            )}
                        </div>
                    ))}
                </motion.div>
            </div>

            {/* ── Dots de navigation ───────────────── */}
            {properties.length > slidesVisible && (
                <div className="flex justify-center items-center gap-2 mt-8">
                    {Array.from({ length: maxIndex + 1 }, (_, i) => (
                        <button
                            key={i}
                            onClick={() => goTo(i)}
                            aria-label={`Page ${i + 1}`}
                            className="rounded-full transition-all duration-300"
                            style={{
                                width:           i === currentIndex ? '24px' : '8px',
                                height:          '8px',
                                backgroundColor: i === currentIndex ? colors.primary : '#D1D5DB',
                                boxShadow:       i === currentIndex ? `0 2px 8px ${colors.shadow}` : 'none',
                            }}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default HomeSlider;