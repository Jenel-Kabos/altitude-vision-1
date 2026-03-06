import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Building2, Calendar, Briefcase } from 'lucide-react';

// ─────────────────────────────────────────────
// Données des slides
// ─────────────────────────────────────────────
const slides = [
    {
        title: "L'Immobilier\nde Prestige",
        subtitle: "Trouvez le bien qui vous ressemble — vente, location, conseil expert à Brazzaville",
        image: "https://images.unsplash.com/photo-1507089947368-19c1da9775ae?auto=format&fit=crop&w=1600&q=80",
        cta: { label: "Découvrir Altimmo", route: "/altimmo" },
        accent: "#2E7BB5",   // Bleu Altimmo
        pole: "Altimmo",
    },
    {
        title: "L'Art de\nl'Événementiel",
        subtitle: "Mariages, galas, conférences — nous transformons chaque moment en souvenir inoubliable",
        image: "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?q=80&w=1170&auto=format&fit=crop",
        cta: { label: "Découvrir Mila Events", route: "/mila-events" },
        accent: "#D42B2B",   // Rouge Mila Events
        pole: "Mila Events",
    },
    {
        title: "La Communication\nQui Impacte",
        subtitle: "Stratégie, branding, visibilité digitale — propulsez votre image au niveau supérieur",
        image: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=1170&auto=format&fit=crop",
        cta: { label: "Découvrir Altcom", route: "/altcom" },
        accent: "#C8872A",   // Or Altcom
        pole: "Altcom",
    },
];

// Bandeau pôles en bas du hero
const poles = [
    { label: "Altimmo",     sub: "Immobilier",    icon: Building2, route: "/altimmo",     color: "#2E7BB5" },
    { label: "Mila Events", sub: "Événementiel",  icon: Calendar,  route: "/mila-events", color: "#D42B2B" },
    { label: "Altcom",      sub: "Communication", icon: Briefcase, route: "/altcom",      color: "#C8872A" },
];

const SLIDE_DURATION = 7000;

// ─────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────
const HeroSlider = () => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [direction, setDirection]       = useState(1);
    const [progress, setProgress]         = useState(0);
    const timerRef    = useRef(null);
    const progressRef = useRef(null);

    // ── Gestion des timers ──────────────────
    const resetTimers = useCallback(() => {
        clearInterval(timerRef.current);
        clearInterval(progressRef.current);
        setProgress(0);

        timerRef.current = setInterval(() => {
            setDirection(1);
            setCurrentIndex(prev => (prev + 1) % slides.length);
            setProgress(0);
        }, SLIDE_DURATION);

        progressRef.current = setInterval(() => {
            setProgress(prev => Math.min(prev + 100 / (SLIDE_DURATION / 50), 100));
        }, 50);
    }, []);

    useEffect(() => {
        resetTimers();
        return () => {
            clearInterval(timerRef.current);
            clearInterval(progressRef.current);
        };
    }, [resetTimers]);

    // ── Navigation ──────────────────────────
    const goTo = (index) => {
        if (index === currentIndex) return;
        setDirection(index > currentIndex ? 1 : -1);
        setCurrentIndex(index);
        resetTimers();
    };

    const prev = () => {
        setDirection(-1);
        setCurrentIndex(prev => (prev - 1 + slides.length) % slides.length);
        resetTimers();
    };

    const next = () => {
        setDirection(1);
        setCurrentIndex(prev => (prev + 1) % slides.length);
        resetTimers();
    };

    // ── Variants d'animation ────────────────
    const slideVariants = {
        enter: (dir) => ({
            x: dir > 0 ? '100%' : '-100%',
            opacity: 0,
        }),
        center: {
            x: '0%',
            opacity: 1,
            transition: { duration: 0.75, ease: [0.25, 0.46, 0.45, 0.94] },
        },
        exit: (dir) => ({
            x: dir < 0 ? '100%' : '-100%',
            opacity: 0,
            transition: { duration: 0.6, ease: [0.55, 0, 1, 0.45] },
        }),
    };

    const textVariants = {
        hidden: { opacity: 0, y: 32 },
        visible: (delay) => ({
            opacity: 1,
            y: 0,
            transition: { duration: 0.7, delay, ease: [0.25, 0.46, 0.45, 0.94] },
        }),
    };

    const current = slides[currentIndex];

    return (
        <div className="absolute inset-0 overflow-hidden">

            {/* ── Slides ─────────────────────────── */}
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
                        className="absolute inset-0 bg-cover bg-center"
                        style={{ backgroundImage: `url(${current.image})` }}
                        initial={{ scale: 1.08 }}
                        animate={{ scale: 1.02 }}
                        transition={{ duration: SLIDE_DURATION / 1000, ease: 'linear' }}
                    />

                    {/* Overlay multicouche — dégradé dramatique */}
                    <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/20" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />

                    {/* Accent coloré discret en bas-gauche */}
                    <motion.div
                        className="absolute bottom-0 left-0 w-1 h-full opacity-60"
                        style={{ background: `linear-gradient(to top, ${current.accent}, transparent)` }}
                        initial={{ scaleY: 0, originY: 1 }}
                        animate={{ scaleY: 1 }}
                        transition={{ duration: 1, delay: 0.3 }}
                    />
                </motion.div>
            </AnimatePresence>

            {/* ── Contenu texte ───────────────────── */}
            <div className="absolute inset-0 z-10 flex flex-col justify-center px-8 sm:px-16 lg:px-24 pb-32">
                <AnimatePresence mode="wait">
                    <div key={currentIndex}>

                        {/* Badge pôle */}
                        <motion.div
                            custom={0.1}
                            variants={textVariants}
                            initial="hidden"
                            animate="visible"
                            className="mb-4"
                        >
                            <span
                                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest text-white border border-white/20 backdrop-blur-sm"
                                style={{ backgroundColor: `${current.accent}33` }}
                            >
                                <span
                                    className="w-1.5 h-1.5 rounded-full animate-pulse"
                                    style={{ backgroundColor: current.accent }}
                                />
                                {current.pole}
                            </span>
                        </motion.div>

                        {/* Titre — Cormorant Garamond */}
                        <motion.h1
                            custom={0.25}
                            variants={textVariants}
                            initial="hidden"
                            animate="visible"
                            className="text-white mb-5 max-w-3xl"
                            style={{
                                fontFamily: "'Cormorant Garamond', Georgia, serif",
                                fontSize: 'clamp(2.8rem, 6vw, 5.5rem)',
                                fontWeight: 700,
                                lineHeight: 1.1,
                                letterSpacing: '-0.02em',
                                whiteSpace: 'pre-line',
                            }}
                        >
                            {current.title}
                        </motion.h1>

                        {/* Ligne dorée décorative */}
                        <motion.div
                            custom={0.35}
                            variants={textVariants}
                            initial="hidden"
                            animate="visible"
                            className="mb-5"
                        >
                            <div
                                className="h-0.5 w-20 rounded-full"
                                style={{ background: `linear-gradient(to right, ${current.accent}, transparent)` }}
                            />
                        </motion.div>

                        {/* Sous-titre — Outfit */}
                        <motion.p
                            custom={0.4}
                            variants={textVariants}
                            initial="hidden"
                            animate="visible"
                            className="text-white/80 mb-8 max-w-xl leading-relaxed"
                            style={{
                                fontFamily: "'Outfit', sans-serif",
                                fontSize: 'clamp(1rem, 1.8vw, 1.2rem)',
                                fontWeight: 300,
                            }}
                        >
                            {current.subtitle}
                        </motion.p>

                        {/* Boutons CTA */}
                        <motion.div
                            custom={0.55}
                            variants={textVariants}
                            initial="hidden"
                            animate="visible"
                            className="flex flex-wrap gap-3"
                        >
                            <Link
                                to={current.cta.route}
                                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold text-white text-sm transition-all duration-300 hover:scale-105 hover:shadow-2xl"
                                style={{
                                    background: `linear-gradient(135deg, ${current.accent}, ${current.accent}cc)`,
                                    fontFamily: "'Outfit', sans-serif",
                                    boxShadow: `0 8px 32px ${current.accent}50`,
                                }}
                            >
                                {current.cta.label}
                                <span className="text-base">→</span>
                            </Link>

                            <Link
                                to="/contact"
                                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold text-white text-sm border border-white/30 backdrop-blur-sm hover:bg-white/15 transition-all duration-300 hover:scale-105"
                                style={{ fontFamily: "'Outfit', sans-serif" }}
                            >
                                Nous contacter
                            </Link>
                        </motion.div>
                    </div>
                </AnimatePresence>
            </div>

            {/* ── Navigation gauche/droite ────────── */}
            <button
                onClick={prev}
                aria-label="Slide précédente"
                className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-white/10 hover:bg-white/25 backdrop-blur-md border border-white/15 text-white transition-all duration-300 hover:scale-110 active:scale-95"
            >
                <ChevronLeft className="w-5 h-5" />
            </button>

            <button
                onClick={next}
                aria-label="Slide suivante"
                className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-white/10 hover:bg-white/25 backdrop-blur-md border border-white/15 text-white transition-all duration-300 hover:scale-110 active:scale-95"
            >
                <ChevronRight className="w-5 h-5" />
            </button>

            {/* ── Compteur discret ────────────────── */}
            <div className="absolute top-6 right-6 z-20 text-white/40 text-xs font-light tracking-widest select-none pointer-events-none"
                style={{ fontFamily: "'Outfit', sans-serif" }}>
                {String(currentIndex + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
            </div>

            {/* ── Indicateurs + barre progression ─── */}
            <div className="absolute bottom-[7.5rem] right-6 sm:right-8 z-20 flex flex-col items-end gap-3">
                {/* Barre de progression verticale */}
                <div className="w-0.5 h-16 bg-white/15 rounded-full overflow-hidden">
                    <motion.div
                        className="w-full rounded-full"
                        style={{
                            height: `${progress}%`,
                            background: current.accent,
                        }}
                        transition={{ ease: 'linear' }}
                    />
                </div>

                {/* Dots */}
                <div className="flex flex-col gap-2">
                    {slides.map((s, i) => (
                        <button
                            key={i}
                            onClick={() => goTo(i)}
                            aria-label={`Aller à la slide ${i + 1}`}
                            className="rounded-full transition-all duration-400"
                            style={{
                                width: i === currentIndex ? '10px' : '6px',
                                height: i === currentIndex ? '10px' : '6px',
                                backgroundColor: i === currentIndex ? current.accent : 'rgba(255,255,255,0.35)',
                                boxShadow: i === currentIndex ? `0 0 8px ${current.accent}` : 'none',
                            }}
                        />
                    ))}
                </div>
            </div>

            {/* ── Bandeau pôles en bas ─────────────── */}
            <div className="absolute bottom-0 left-0 right-0 z-20">
                {/* Ligne séparatrice */}
                <div className="h-px bg-white/10" />

                <div className="backdrop-blur-md bg-black/40 grid grid-cols-3">
                    {poles.map((pole, i) => {
                        const Icon = pole.icon;
                        const isActive = slides[currentIndex].pole === pole.label;

                        return (
                            <Link
                                key={i}
                                to={pole.route}
                                className="group flex items-center gap-3 px-5 py-4 transition-all duration-300 hover:bg-white/10 relative overflow-hidden"
                            >
                                {/* Indicateur coloré en haut */}
                                <div
                                    className="absolute top-0 left-0 right-0 h-0.5 transition-all duration-300"
                                    style={{
                                        backgroundColor: pole.color,
                                        opacity: isActive ? 1 : 0,
                                    }}
                                />
                                <div
                                    className="absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-all duration-300"
                                    style={{ backgroundColor: pole.color }}
                                />

                                {/* Icône */}
                                <div
                                    className="p-2 rounded-xl flex-shrink-0 transition-all duration-300"
                                    style={{
                                        backgroundColor: isActive ? `${pole.color}30` : 'rgba(255,255,255,0.08)',
                                    }}
                                >
                                    <Icon
                                        className="w-4 h-4 sm:w-5 sm:h-5"
                                        style={{ color: isActive ? pole.color : 'rgba(255,255,255,0.6)' }}
                                    />
                                </div>

                                {/* Texte */}
                                <div className="hidden sm:block min-w-0">
                                    <p
                                        className="text-sm font-semibold truncate transition-colors duration-300"
                                        style={{
                                            fontFamily: "'Outfit', sans-serif",
                                            color: isActive ? 'white' : 'rgba(255,255,255,0.7)',
                                        }}
                                    >
                                        {pole.label}
                                    </p>
                                    <p
                                        className="text-xs truncate"
                                        style={{
                                            fontFamily: "'Outfit', sans-serif",
                                            color: isActive ? pole.color : 'rgba(255,255,255,0.4)',
                                        }}
                                    >
                                        {pole.sub}
                                    </p>
                                </div>

                                {/* Flèche hover */}
                                <span
                                    className="ml-auto text-xs opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:translate-x-1 hidden sm:block"
                                    style={{ color: pole.color }}
                                >
                                    →
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default HeroSlider;