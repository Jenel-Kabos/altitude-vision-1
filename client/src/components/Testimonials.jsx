import React, { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Quote, Loader2, MessageSquarePlus, Star, ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getAllTestimonials } from "../services/reviewService";
import { useAuth } from "../context/AuthContext";

// ─────────────────────────────────────────────────────────────
// Couleur par pôle — palette Altitude-Vision
// ─────────────────────────────────────────────────────────────
const POLE_COLORS = {
    Altimmo:    { bg: 'rgba(46,123,181,0.15)',  border: 'rgba(46,123,181,0.3)',  text: '#7BB8E0',  dot: '#2E7BB5' },
    MilaEvents: { bg: 'rgba(212,43,43,0.15)',   border: 'rgba(212,43,43,0.3)',   text: '#F08080',  dot: '#D42B2B' },
    Altcom:     { bg: 'rgba(200,135,42,0.15)',  border: 'rgba(200,135,42,0.3)',  text: '#E5A84B',  dot: '#C8872A' },
    default:    { bg: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.15)', text: '#9CA3AF', dot: '#6B7280' },
};

const getPoleColor = (pole) => POLE_COLORS[pole] || POLE_COLORS.default;

const SLIDE_DURATION = 6000;

// ─────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────
const Testimonials = () => {
    const [testimonials, setTestimonials] = useState([]);
    const [isLoading, setIsLoading]       = useState(true);
    const [error, setError]               = useState(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [direction, setDirection]       = useState(1);
    const timerRef = useRef(null);

    const { user }   = useAuth();
    const navigate   = useNavigate();

    // ── Chargement des avis ─────────────────
    useEffect(() => {
        const fetchData = async () => {
            try {
                setIsLoading(true);
                setError(null);
                const data = await getAllTestimonials(10);
                setTestimonials(Array.isArray(data) ? data : []);
            } catch {
                setTestimonials([]);
                setError('Impossible de charger les avis');
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    // ── Timer auto ─────────────────────────
    const resetTimer = useCallback(() => {
        clearInterval(timerRef.current);
        if (testimonials.length <= 1) return;
        timerRef.current = setInterval(() => {
            setDirection(1);
            setCurrentIndex(prev => (prev + 1) % testimonials.length);
        }, SLIDE_DURATION);
    }, [testimonials.length]);

    useEffect(() => {
        resetTimer();
        return () => clearInterval(timerRef.current);
    }, [resetTimer]);

    // ── Navigation ──────────────────────────
    const prev = () => {
        if (testimonials.length <= 1) return;
        setDirection(-1);
        setCurrentIndex(prev => (prev - 1 + testimonials.length) % testimonials.length);
        resetTimer();
    };

    const next = () => {
        if (testimonials.length <= 1) return;
        setDirection(1);
        setCurrentIndex(prev => (prev + 1) % testimonials.length);
        resetTimer();
    };

    const goTo = (i) => {
        setDirection(i > currentIndex ? 1 : -1);
        setCurrentIndex(i);
        resetTimer();
    };

    const handleLeaveReview = () => {
        navigate(user ? '/avis/nouveau' : '/login', {
            state: user ? undefined : { from: '/avis/nouveau' }
        });
    };

    // ── Variants animation ──────────────────
    const variants = {
        enter:  (dir) => ({ x: dir > 0 ? '60%' : '-60%', opacity: 0 }),
        center: { x: '0%', opacity: 1, transition: { duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] } },
        exit:   (dir) => ({ x: dir < 0 ? '60%' : '-60%', opacity: 0, transition: { duration: 0.4, ease: [0.55, 0, 1, 0.45] } }),
    };

    // ── État chargement ─────────────────────
    if (isLoading) {
        return (
            <section className="py-24 bg-gray-900 flex justify-center items-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 text-[#C8872A] animate-spin" />
                    <p className="text-gray-400" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        Chargement des avis...
                    </p>
                </div>
            </section>
        );
    }

    // ── État erreur ─────────────────────────
    if (error) {
        return (
            <section className="py-24 bg-gray-900 text-white text-center">
                <p className="text-gray-400 mb-6">{error}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="px-6 py-3 bg-[#2E7BB5] hover:bg-[#1A5A8A] rounded-full transition-colors text-sm font-semibold"
                >
                    Réessayer
                </button>
            </section>
        );
    }

    const current = testimonials[currentIndex];

    return (
        <section className="py-24 bg-gradient-to-br from-gray-950 via-[#0D1117] to-gray-900 text-white relative overflow-hidden">

            {/* ── Halos de fond aux couleurs du logo ── */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-[120px] opacity-10"
                    style={{ background: '#2E7BB5' }} />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full blur-[120px] opacity-8"
                    style={{ background: '#C8872A' }} />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full blur-[100px] opacity-6"
                    style={{ background: '#D42B2B' }} />
            </div>

            <div className="container mx-auto px-6 md:px-12 lg:px-24 relative z-10">

                {/* ── En-tête ─────────────────────────── */}
                <motion.div
                    className="text-center mb-16"
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                >
                    <p className="text-xs font-bold uppercase tracking-widest mb-3"
                        style={{ color: '#C8872A', fontFamily: "'Outfit', sans-serif" }}>
                        Témoignages
                    </p>
                    <h2
                        className="mb-4"
                        style={{
                            fontFamily: "'Cormorant Garamond', Georgia, serif",
                            fontSize: 'clamp(2rem, 4vw, 3.5rem)',
                            fontWeight: 700,
                            lineHeight: 1.1,
                        }}
                    >
                        Ce que disent nos clients
                    </h2>
                    <div className="h-0.5 w-20 mx-auto rounded-full"
                        style={{ background: 'linear-gradient(to right, #C8872A, transparent)' }} />
                </motion.div>

                {/* ── Slider ──────────────────────────── */}
                {testimonials.length > 0 ? (
                    <div className="relative max-w-4xl mx-auto">

                        {/* Flèche gauche */}
                        {testimonials.length > 1 && (
                            <button
                                onClick={prev}
                                aria-label="Avis précédent"
                                className="absolute -left-4 sm:-left-12 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full border border-white/10 bg-white/5 hover:bg-white/15 backdrop-blur-sm flex items-center justify-center transition-all duration-200 hover:scale-110"
                            >
                                <ChevronLeft className="w-5 h-5 text-white/70" />
                            </button>
                        )}

                        {/* Flèche droite */}
                        {testimonials.length > 1 && (
                            <button
                                onClick={next}
                                aria-label="Avis suivant"
                                className="absolute -right-4 sm:-right-12 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full border border-white/10 bg-white/5 hover:bg-white/15 backdrop-blur-sm flex items-center justify-center transition-all duration-200 hover:scale-110"
                            >
                                <ChevronRight className="w-5 h-5 text-white/70" />
                            </button>
                        )}

                        {/* Card témoignage */}
                        <div className="overflow-hidden px-1 py-2">
                            <AnimatePresence initial={false} custom={direction} mode="wait">
                                {current && (
                                    <motion.div
                                        key={current._id || currentIndex}
                                        custom={direction}
                                        variants={variants}
                                        initial="enter"
                                        animate="center"
                                        exit="exit"
                                        className="flex flex-col items-center text-center"
                                    >
                                        {/* Avatar */}
                                        <div className="relative mb-6">
                                            <img
                                                src={
                                                    current.author?.photo ||
                                                    `https://ui-avatars.com/api/?name=${encodeURIComponent(current.author?.name || 'Client')}&background=1e293b&color=fff&size=128`
                                                }
                                                alt={current.author?.name || 'Client'}
                                                className="w-24 h-24 rounded-full object-cover border-2 shadow-2xl"
                                                style={{ borderColor: getPoleColor(current.pole).dot }}
                                                onError={(e) => {
                                                    e.target.onerror = null;
                                                    e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(current.author?.name || 'Client')}&background=1e293b&color=fff&size=128`;
                                                }}
                                            />
                                            {/* Icône quote */}
                                            <div
                                                className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-2 border-gray-950"
                                                style={{ backgroundColor: getPoleColor(current.pole).dot }}
                                            >
                                                <Quote className="w-3.5 h-3.5 text-white" fill="currentColor" />
                                            </div>
                                        </div>

                                        {/* Étoiles */}
                                        {current.rating && (
                                            <div className="flex gap-1 mb-3">
                                                {[...Array(5)].map((_, i) => (
                                                    <Star
                                                        key={i}
                                                        className={i < current.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-700"}
                                                        size={15}
                                                    />
                                                ))}
                                            </div>
                                        )}

                                        {/* Badge pôle */}
                                        {current.pole && (
                                            <span
                                                className="inline-block px-4 py-1 mb-5 rounded-full text-xs font-semibold border"
                                                style={{
                                                    backgroundColor: getPoleColor(current.pole).bg,
                                                    borderColor:     getPoleColor(current.pole).border,
                                                    color:           getPoleColor(current.pole).text,
                                                    fontFamily:      "'Outfit', sans-serif",
                                                }}
                                            >
                                                {current.pole}
                                            </span>
                                        )}

                                        {/* Citation */}
                                        <blockquote
                                            className="text-lg md:text-xl text-gray-300 leading-relaxed mb-6 max-w-2xl italic"
                                            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(1.1rem, 2vw, 1.35rem)' }}
                                        >
                                            "{current.comment}"
                                        </blockquote>

                                        {/* Auteur */}
                                        <div>
                                            <p className="font-bold text-white text-lg"
                                                style={{ fontFamily: "'Outfit', sans-serif" }}>
                                                {current.author?.name || 'Client'}
                                            </p>
                                            <p className="text-sm mt-0.5"
                                                style={{ color: getPoleColor(current.pole).text, fontFamily: "'Outfit', sans-serif" }}>
                                                Client {current.pole}
                                            </p>
                                        </div>

                                        {/* Réponse admin */}
                                        {current.adminResponse?.text && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: 0.3 }}
                                                className="mt-6 max-w-xl w-full text-left rounded-2xl p-5 border backdrop-blur-sm"
                                                style={{
                                                    backgroundColor: 'rgba(46,123,181,0.08)',
                                                    borderColor:     'rgba(46,123,181,0.2)',
                                                }}
                                            >
                                                <div className="flex items-center gap-2 mb-2">
                                                    <ShieldCheck className="w-4 h-4 text-[#2E7BB5]" />
                                                    <span className="text-xs font-semibold text-[#7BB8E0]"
                                                        style={{ fontFamily: "'Outfit', sans-serif" }}>
                                                        Réponse de l'équipe Altitude-Vision
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-300 leading-relaxed italic"
                                                    style={{ fontFamily: "'Outfit', sans-serif" }}>
                                                    {current.adminResponse.text}
                                                </p>
                                            </motion.div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Dots */}
                        {testimonials.length > 1 && (
                            <div className="flex justify-center gap-2 mt-10">
                                {testimonials.map((_, i) => (
                                    <button
                                        key={i}
                                        onClick={() => goTo(i)}
                                        aria-label={`Avis ${i + 1}`}
                                        className="rounded-full transition-all duration-300"
                                        style={{
                                            width:           i === currentIndex ? '24px' : '8px',
                                            height:          '8px',
                                            backgroundColor: i === currentIndex
                                                ? (current ? getPoleColor(current.pole).dot : '#C8872A')
                                                : 'rgba(255,255,255,0.2)',
                                        }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    /* ── État vide ────────────────────── */
                    <div className="text-center py-10">
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/5 border border-white/10 mb-6">
                            <Star className="w-9 h-9 text-gray-600" />
                        </div>
                        <p className="text-gray-400 text-lg mb-1"
                            style={{ fontFamily: "'Outfit', sans-serif" }}>
                            Aucun avis disponible
                        </p>
                        <p className="text-gray-600 text-sm"
                            style={{ fontFamily: "'Outfit', sans-serif" }}>
                            Soyez le premier à partager votre expérience !
                        </p>
                    </div>
                )}

                {/* ── Bouton laisser un avis ───────────── */}
                <div className="text-center mt-16 relative z-10">
                    <motion.button
                        onClick={handleLeaveReview}
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.97 }}
                        className="inline-flex items-center gap-3 px-8 py-4 rounded-full font-semibold text-white shadow-2xl transition-all duration-300"
                        style={{
                            background:  'linear-gradient(135deg, #C8872A, #E5A84B)',
                            boxShadow:   '0 8px 32px rgba(200,135,42,0.35)',
                            fontFamily:  "'Outfit', sans-serif",
                        }}
                    >
                        <MessageSquarePlus className="w-5 h-5" />
                        Laisser un avis
                    </motion.button>
                    {!user && (
                        <p className="text-xs text-gray-600 mt-3"
                            style={{ fontFamily: "'Outfit', sans-serif" }}>
                            (Connexion requise)
                        </p>
                    )}
                </div>
            </div>
        </section>
    );
};

export default Testimonials;