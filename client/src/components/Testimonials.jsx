import React, { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Quote, Loader2, MessageSquarePlus, Star, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getAllTestimonials } from "../services/reviewService";
import { useAuth } from "../context/AuthContext";

// ─────────────────────────────────────────────────────────────
// Couleurs par pôle
// ─────────────────────────────────────────────────────────────
const POLE_COLORS = {
    Altimmo:    { dot: '#2E7BB5', bg: 'rgba(46,123,181,0.08)',  border: 'rgba(46,123,181,0.15)',  text: '#2E7BB5' },
    MilaEvents: { dot: '#D42B2B', bg: 'rgba(212,43,43,0.08)',   border: 'rgba(212,43,43,0.15)',   text: '#D42B2B' },
    Altcom:     { dot: '#C8872A', bg: 'rgba(200,135,42,0.08)',  border: 'rgba(200,135,42,0.15)',  text: '#C8872A' },
    default:    { dot: '#9CA3AF', bg: 'rgba(156,163,175,0.08)', border: 'rgba(156,163,175,0.15)', text: '#9CA3AF' },
};
const getPole = (pole) => POLE_COLORS[pole] || POLE_COLORS.default;

const SLIDE_DURATION = 6000;

// ─────────────────────────────────────────────────────────────
// Card individuelle
// ─────────────────────────────────────────────────────────────
const TestimonialCard = ({ t, index }) => {
    const pc = getPole(t.pole);

    return (
        <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.55, delay: index * 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="relative bg-white rounded-2xl p-6 flex flex-col gap-4 border group hover:shadow-xl transition-all duration-500 hover:-translate-y-1"
            style={{ borderColor: 'rgba(0,0,0,0.07)' }}
        >
            {/* Ligne colorée en haut — apparaît au hover */}
            <div
                className="absolute top-0 left-6 right-6 h-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ backgroundColor: pc.dot }}
            />

            {/* Guillemet décoratif */}
            <Quote
                className="absolute top-5 right-5 opacity-[0.06]"
                style={{ width: 36, height: 36, color: pc.dot }}
                fill="currentColor"
            />

            {/* Étoiles */}
            {t.rating && (
                <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                        <Star
                            key={i}
                            size={13}
                            className={i < t.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}
                        />
                    ))}
                </div>
            )}

            {/* Citation */}
            <blockquote
                className="text-gray-600 leading-relaxed flex-1 relative z-10"
                style={{
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    fontSize:   'clamp(1rem, 1.3vw, 1.08rem)',
                    fontStyle:  'italic',
                }}
            >
                "{t.comment}"
            </blockquote>

            {/* Séparateur */}
            <div className="h-px bg-gray-100" />

            {/* Auteur */}
            <div className="flex items-center gap-3 relative z-10">
                <img
                    src={
                        t.author?.photo ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(t.author?.name || 'Client')}&background=f1f5f9&color=64748b&size=80`
                    }
                    alt={t.author?.name || 'Client'}
                    className="w-9 h-9 rounded-full object-cover border-2 flex-shrink-0"
                    style={{ borderColor: pc.dot }}
                    onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(t.author?.name || 'Client')}&background=f1f5f9&color=64748b&size=80`;
                    }}
                />
                <div className="min-w-0 flex-1">
                    <p
                        className="font-bold text-gray-900 text-sm truncate leading-tight"
                        style={{ fontFamily: "'Outfit', sans-serif" }}
                    >
                        {t.author?.name || 'Client'}
                    </p>
                    {t.pole && (
                        <span
                            className="text-xs font-medium"
                            style={{ color: pc.dot, fontFamily: "'Outfit', sans-serif" }}
                        >
                            {t.pole}
                        </span>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

// ─────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────
const Testimonials = () => {
    const [testimonials, setTestimonials] = useState([]);
    const [isLoading, setIsLoading]       = useState(true);
    const [error, setError]               = useState(null);
    const [page, setPage]                 = useState(0);
    const timerRef                        = useRef(null);

    const { user } = useAuth();
    const navigate = useNavigate();

    // ── Chargement ──────────────────────────
    useEffect(() => {
        const fetchData = async () => {
            try {
                const data = await getAllTestimonials(12);
                setTestimonials(Array.isArray(data) ? data : []);
            } catch {
                setError('Impossible de charger les avis');
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    // ── Pagination — 3 cards par page ───────
    const CARDS_PER_PAGE = 3;
    const totalPages     = Math.ceil(testimonials.length / CARDS_PER_PAGE);
    const visibleCards   = testimonials.slice(page * CARDS_PER_PAGE, page * CARDS_PER_PAGE + CARDS_PER_PAGE);

    // ── Timer auto ──────────────────────────
    const resetTimer = useCallback(() => {
        clearInterval(timerRef.current);
        if (totalPages <= 1) return;
        timerRef.current = setInterval(() => {
            setPage(p => (p + 1) % totalPages);
        }, SLIDE_DURATION);
    }, [totalPages]);

    useEffect(() => {
        resetTimer();
        return () => clearInterval(timerRef.current);
    }, [resetTimer]);

    const prev = () => { setPage(p => (p - 1 + totalPages) % totalPages); resetTimer(); };
    const next = () => { setPage(p => (p + 1) % totalPages); resetTimer(); };

    const handleLeaveReview = () =>
        navigate(user ? '/avis/nouveau' : '/login', {
            state: user ? undefined : { from: '/avis/nouveau' },
        });

    // ── États ───────────────────────────────
    if (isLoading) return (
        <section className="py-16 flex justify-center items-center min-h-[200px] bg-gray-50">
            <Loader2 className="w-7 h-7 animate-spin" style={{ color: '#C8872A' }} />
        </section>
    );

    if (error || !testimonials.length) return (
        <section className="py-16 bg-gray-50 text-center px-6">
            <Star className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm mb-5" style={{ fontFamily: "'Outfit', sans-serif" }}>
                {error || "Aucun avis — soyez le premier à partager votre expérience !"}
            </p>
            <button
                onClick={handleLeaveReview}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-white text-sm"
                style={{ background: 'linear-gradient(135deg, #C8872A, #E5A84B)', fontFamily: "'Outfit', sans-serif" }}
            >
                <MessageSquarePlus className="w-4 h-4" />
                Laisser un avis
            </button>
        </section>
    );

    return (
        <section className="py-16 sm:py-20 bg-gray-50 relative overflow-hidden">

            {/* Décoration fond */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-0 right-0 h-px"
                    style={{ background: 'linear-gradient(to right, transparent, rgba(200,135,42,0.2), transparent)' }} />
                <div className="absolute bottom-0 left-0 right-0 h-px"
                    style={{ background: 'linear-gradient(to right, transparent, rgba(46,123,181,0.2), transparent)' }} />
            </div>

            <div className="container mx-auto px-4 sm:px-6 max-w-6xl relative z-10">

                {/* ── En-tête ─────────────────────────── */}
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-10">

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                    >
                        <p
                            className="text-xs font-bold uppercase tracking-widest mb-2"
                            style={{ color: '#C8872A', fontFamily: "'Outfit', sans-serif" }}
                        >
                            Témoignages
                        </p>
                        <h2
                            className="text-gray-900"
                            style={{
                                fontFamily: "'Cormorant Garamond', Georgia, serif",
                                fontSize:   'clamp(1.8rem, 3.5vw, 2.8rem)',
                                fontWeight: 700,
                                lineHeight: 1.1,
                            }}
                        >
                            Ce que disent nos clients
                        </h2>
                        <div className="h-0.5 w-12 mt-3 rounded-full"
                            style={{ background: 'linear-gradient(to right, #C8872A, #2E7BB5)' }} />
                    </motion.div>

                    {/* Contrôles droite */}
                    <motion.div
                        className="flex items-center gap-4 flex-shrink-0"
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                    >
                        {/* Compteur page */}
                        {totalPages > 1 && (
                            <span
                                className="text-sm text-gray-400 tabular-nums"
                                style={{ fontFamily: "'Outfit', sans-serif" }}
                            >
                                {String(page + 1).padStart(2, '0')} / {String(totalPages).padStart(2, '0')}
                            </span>
                        )}

                        {/* Flèches */}
                        {totalPages > 1 && (
                            <div className="flex gap-2">
                                <button
                                    onClick={prev}
                                    aria-label="Page précédente"
                                    className="w-9 h-9 rounded-full border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 flex items-center justify-center transition-all duration-200 hover:scale-105 shadow-sm"
                                >
                                    <ChevronLeft className="w-4 h-4 text-gray-500" />
                                </button>
                                <button
                                    onClick={next}
                                    aria-label="Page suivante"
                                    className="w-9 h-9 rounded-full border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 flex items-center justify-center transition-all duration-200 hover:scale-105 shadow-sm"
                                >
                                    <ChevronRight className="w-4 h-4 text-gray-500" />
                                </button>
                            </div>
                        )}

                        {/* CTA */}
                        <motion.button
                            onClick={handleLeaveReview}
                            whileHover={{ scale: 1.04 }}
                            whileTap={{ scale: 0.97 }}
                            className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-white text-sm"
                            style={{
                                background: 'linear-gradient(135deg, #C8872A, #E5A84B)',
                                boxShadow:  '0 4px 16px rgba(200,135,42,0.25)',
                                fontFamily: "'Outfit', sans-serif",
                            }}
                        >
                            <MessageSquarePlus className="w-4 h-4" />
                            Laisser un avis
                        </motion.button>
                    </motion.div>
                </div>

                {/* ── Grille 3 cards ───────────────────── */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={page}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.35 }}
                        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                    >
                        {visibleCards.map((t, i) => (
                            <TestimonialCard key={t._id || i} t={t} index={i} />
                        ))}

                        {/* Placeholders si moins de 3 cards sur la dernière page */}
                        {visibleCards.length < CARDS_PER_PAGE &&
                            Array.from({ length: CARDS_PER_PAGE - visibleCards.length }).map((_, i) => (
                                <div key={`ph-${i}`} className="hidden lg:block" />
                            ))
                        }
                    </motion.div>
                </AnimatePresence>

                {/* ── Dots + CTA mobile ─────────────────── */}
                <div className="flex items-center justify-between mt-8">
                    {/* Dots */}
                    {totalPages > 1 && (
                        <div className="flex gap-1.5">
                            {Array.from({ length: totalPages }).map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => { setPage(i); resetTimer(); }}
                                    aria-label={`Page ${i + 1}`}
                                    className="rounded-full transition-all duration-300"
                                    style={{
                                        width:           i === page ? '20px' : '6px',
                                        height:          '6px',
                                        backgroundColor: i === page ? '#C8872A' : '#D1D5DB',
                                    }}
                                />
                            ))}
                        </div>
                    )}

                    {/* CTA mobile */}
                    <motion.button
                        onClick={handleLeaveReview}
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.97 }}
                        className="sm:hidden inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-white text-sm ml-auto"
                        style={{
                            background: 'linear-gradient(135deg, #C8872A, #E5A84B)',
                            fontFamily: "'Outfit', sans-serif",
                        }}
                    >
                        <MessageSquarePlus className="w-4 h-4" />
                        Laisser un avis
                    </motion.button>
                </div>
            </div>
        </section>
    );
};

export default Testimonials;