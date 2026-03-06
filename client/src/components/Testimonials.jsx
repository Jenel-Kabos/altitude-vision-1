import React, { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Quote, Loader2, MessageSquarePlus, Star, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getAllTestimonials } from "../services/reviewService";
import { useAuth } from "../context/AuthContext";

const POLE_COLORS = {
    Altimmo:    { dot: '#2E7BB5', bg: 'rgba(46,123,181,0.1)',  border: 'rgba(46,123,181,0.2)',  text: '#2E7BB5' },
    MilaEvents: { dot: '#D42B2B', bg: 'rgba(212,43,43,0.1)',   border: 'rgba(212,43,43,0.2)',   text: '#D42B2B' },
    Altcom:     { dot: '#C8872A', bg: 'rgba(200,135,42,0.1)',  border: 'rgba(200,135,42,0.2)',  text: '#C8872A' },
    default:    { dot: '#6B7280', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.2)', text: '#6B7280' },
};
const getPole = (pole) => POLE_COLORS[pole] || POLE_COLORS.default;

const SLIDE_DURATION = 5000;

// ─── Card témoignage ────────────────────────────────────────
const TestimonialCard = ({ t, isActive }) => {
    const pc = getPole(t.pole);
    return (
        <motion.div
            animate={{ opacity: isActive ? 1 : 0.4, scale: isActive ? 1 : 0.95 }}
            transition={{ duration: 0.4 }}
            className="relative bg-white rounded-3xl p-6 border flex flex-col gap-4 h-full select-none"
            style={{
                borderColor: isActive ? pc.border : 'rgba(0,0,0,0.05)',
                boxShadow:   isActive ? `0 16px 48px rgba(0,0,0,0.10), 0 0 0 1px ${pc.border}` : 'none',
                minHeight:   '260px',
            }}
        >
            {/* Guillemet décoratif */}
            <div className="absolute top-4 right-5 opacity-8 select-none pointer-events-none"
                style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '4.5rem', lineHeight: 1, color: pc.dot, opacity: 0.08 }}>
                "
            </div>

            {/* Avatar + nom */}
            <div className="flex items-center gap-3 relative z-10">
                <div className="relative flex-shrink-0">
                    <img
                        src={t.author?.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(t.author?.name || 'Client')}&background=f1f5f9&color=475569&size=80`}
                        alt={t.author?.name || 'Client'}
                        className="w-10 h-10 rounded-full object-cover border-2"
                        style={{ borderColor: pc.dot }}
                        onError={(e) => { e.target.onerror = null; e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(t.author?.name || 'Client')}&background=f1f5f9&color=475569&size=80`; }}
                    />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center border-2 border-white"
                        style={{ backgroundColor: pc.dot }}>
                        <Quote className="w-2 h-2 text-white" fill="currentColor" />
                    </div>
                </div>
                <div className="min-w-0 flex-1">
                    <p className="font-bold text-gray-900 text-sm truncate" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        {t.author?.name || 'Client'}
                    </p>
                    {t.pole && (
                        <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: pc.bg, color: pc.text, fontFamily: "'Outfit', sans-serif" }}>
                            {t.pole}
                        </span>
                    )}
                </div>
                {t.rating && (
                    <div className="flex gap-0.5 flex-shrink-0">
                        {[...Array(5)].map((_, i) => (
                            <Star key={i} size={11} className={i < t.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200"} />
                        ))}
                    </div>
                )}
            </div>

            {/* Citation */}
            <blockquote className="text-gray-600 leading-relaxed flex-1 relative z-10"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(0.95rem, 1.4vw, 1.05rem)', fontStyle: 'italic' }}>
                "{t.comment}"
            </blockquote>

            {/* Réponse admin condensée */}
            {t.adminResponse?.text && (
                <div className="rounded-xl p-3 text-xs leading-relaxed relative z-10 border-l-2"
                    style={{ backgroundColor: 'rgba(46,123,181,0.05)', borderColor: '#2E7BB5' }}>
                    <p className="font-semibold text-[#2E7BB5] mb-0.5" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        Réponse Altitude-Vision
                    </p>
                    <p className="text-gray-500 line-clamp-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        {t.adminResponse.text}
                    </p>
                </div>
            )}
        </motion.div>
    );
};

// ─── Composant principal ─────────────────────────────────────
const Testimonials = () => {
    const [testimonials, setTestimonials] = useState([]);
    const [isLoading, setIsLoading]       = useState(true);
    const [error, setError]               = useState(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const timerRef = useRef(null);
    const { user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const fetchData = async () => {
            try {
                const data = await getAllTestimonials(10);
                setTestimonials(Array.isArray(data) ? data : []);
            } catch {
                setError('Impossible de charger les avis');
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    const resetTimer = useCallback(() => {
        clearInterval(timerRef.current);
        if (testimonials.length <= 1) return;
        timerRef.current = setInterval(() => {
            setCurrentIndex(i => (i + 1) % testimonials.length);
        }, SLIDE_DURATION);
    }, [testimonials.length]);

    useEffect(() => { resetTimer(); return () => clearInterval(timerRef.current); }, [resetTimer]);

    const prev = () => { setCurrentIndex(i => (i - 1 + testimonials.length) % testimonials.length); resetTimer(); };
    const next = () => { setCurrentIndex(i => (i + 1) % testimonials.length); resetTimer(); };
    const getItem = (offset) => testimonials[(currentIndex + offset + testimonials.length) % testimonials.length];

    const handleLeaveReview = () => navigate(user ? '/avis/nouveau' : '/login', { state: user ? undefined : { from: '/avis/nouveau' } });

    if (isLoading) return (
        <section className="py-16 flex justify-center items-center min-h-[240px]"
            style={{ background: '#0D1117' }}>
            <Loader2 className="w-7 h-7 animate-spin" style={{ color: '#C8872A' }} />
        </section>
    );

    if (error || !testimonials.length) return (
        <section className="py-16 text-center px-6" style={{ background: '#0D1117' }}>
            <Star className="w-8 h-8 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-400 text-sm mb-5" style={{ fontFamily: "'Outfit', sans-serif" }}>
                {error || "Aucun avis disponible — soyez le premier !"}
            </p>
            <button onClick={handleLeaveReview}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-white text-sm"
                style={{ background: 'linear-gradient(135deg, #C8872A, #E5A84B)', fontFamily: "'Outfit', sans-serif" }}>
                <MessageSquarePlus className="w-4 h-4" />
                Laisser un avis
            </button>
        </section>
    );

    return (
        <section className="py-14 sm:py-16 overflow-hidden relative"
            style={{ background: 'linear-gradient(135deg, #0D1117 0%, #111827 60%, #0D1117 100%)' }}>

            {/* Halos discrets */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -left-20 top-1/2 -translate-y-1/2 w-56 h-56 rounded-full blur-[80px] opacity-10"
                    style={{ background: '#2E7BB5' }} />
                <div className="absolute -right-20 top-1/2 -translate-y-1/2 w-56 h-56 rounded-full blur-[80px] opacity-8"
                    style={{ background: '#C8872A' }} />
            </div>

            {/* Lignes décoratives */}
            <div className="absolute top-0 left-0 right-0 h-px"
                style={{ background: 'linear-gradient(to right, transparent, rgba(200,135,42,0.3), transparent)' }} />
            <div className="absolute bottom-0 left-0 right-0 h-px"
                style={{ background: 'linear-gradient(to right, transparent, rgba(46,123,181,0.3), transparent)' }} />

            <div className="container mx-auto px-4 sm:px-6 max-w-6xl relative z-10">

                {/* En-tête + flèches sur la même ligne */}
                <div className="flex items-center justify-between mb-8">
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                    >
                        <p className="text-xs font-bold uppercase tracking-widest mb-1.5"
                            style={{ color: '#C8872A', fontFamily: "'Outfit', sans-serif" }}>
                            Témoignages
                        </p>
                        <h2 className="text-white"
                            style={{
                                fontFamily: "'Cormorant Garamond', Georgia, serif",
                                fontSize:   'clamp(1.6rem, 3vw, 2.5rem)',
                                fontWeight: 700,
                                lineHeight: 1.1,
                            }}>
                            Ce que disent nos clients
                        </h2>
                    </motion.div>

                    {testimonials.length > 1 && (
                        <div className="flex gap-2 flex-shrink-0">
                            <button onClick={prev} aria-label="Précédent"
                                className="w-9 h-9 rounded-full border border-white/10 bg-white/5 hover:bg-white/15 flex items-center justify-center transition-all hover:scale-110">
                                <ChevronLeft className="w-4 h-4 text-white/70" />
                            </button>
                            <button onClick={next} aria-label="Suivant"
                                className="w-9 h-9 rounded-full border border-white/10 bg-white/5 hover:bg-white/15 flex items-center justify-center transition-all hover:scale-110">
                                <ChevronRight className="w-4 h-4 text-white/70" />
                            </button>
                        </div>
                    )}
                </div>

                {/* Slider 3 cards — centre visible, côtés partiels */}
                <div className="relative">
                    {/* Masques bords */}
                    <div className="absolute left-0 top-0 bottom-0 w-12 z-10 pointer-events-none"
                        style={{ background: 'linear-gradient(to right, #0D1117, transparent)' }} />
                    <div className="absolute right-0 top-0 bottom-0 w-12 z-10 pointer-events-none"
                        style={{ background: 'linear-gradient(to left, #0D1117, transparent)' }} />

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentIndex}
                            initial={{ opacity: 0, x: 30 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -30 }}
                            transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
                            className="grid gap-4"
                            style={{
                                gridTemplateColumns: testimonials.length === 1
                                    ? '1fr'
                                    : '80px 1fr 80px',
                            }}
                        >
                            {testimonials.length > 1 && (
                                <div className="overflow-hidden rounded-3xl">
                                    <TestimonialCard t={getItem(-1)} isActive={false} />
                                </div>
                            )}
                            <TestimonialCard t={getItem(0)} isActive={true} />
                            {testimonials.length > 1 && (
                                <div className="overflow-hidden rounded-3xl">
                                    <TestimonialCard t={getItem(1)} isActive={false} />
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Dots + CTA */}
                <div className="flex items-center justify-between mt-7">
                    <div className="flex gap-1.5">
                        {testimonials.map((_, i) => (
                            <button key={i} onClick={() => { setCurrentIndex(i); resetTimer(); }}
                                aria-label={`Avis ${i + 1}`}
                                className="rounded-full transition-all duration-300"
                                style={{
                                    width:           i === currentIndex ? '18px' : '6px',
                                    height:          '6px',
                                    backgroundColor: i === currentIndex ? '#C8872A' : 'rgba(255,255,255,0.18)',
                                }} />
                        ))}
                    </div>

                    <motion.button
                        onClick={handleLeaveReview}
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.97 }}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-white text-sm"
                        style={{
                            background: 'linear-gradient(135deg, #C8872A, #E5A84B)',
                            boxShadow:  '0 4px 16px rgba(200,135,42,0.3)',
                            fontFamily: "'Outfit', sans-serif",
                        }}
                    >
                        <MessageSquarePlus className="w-4 h-4" />
                        Laisser un avis
                        {!user && <span className="opacity-50 text-xs font-normal">(connexion requise)</span>}
                    </motion.button>
                </div>
            </div>
        </section>
    );
};

export default Testimonials;