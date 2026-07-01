"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import Image from 'next/image';
import { motion, AnimatePresence } from "framer-motion";
import { Quote, Loader2, MessageSquarePlus, Star, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { getAllTestimonials } from "../services/reviewService";
import { useAuth } from '../context/AuthContext';

const POLE_COLORS = {
    Altimmo:    { dot: '#2E7BB5', border: 'rgba(46,123,181,0.15)',  text: '#2E7BB5' },
    MilaEvents: { dot: '#D42B2B', border: 'rgba(212,43,43,0.15)',   text: '#D42B2B' },
    Altcom:     { dot: '#C8960C', border: 'rgba(200,150,12,0.18)',  text: '#C8960C' },
    default:    { dot: '#9CA3AF', border: 'rgba(156,163,175,0.15)', text: '#9CA3AF' },
};
const getPole = (pole) => POLE_COLORS[pole] || POLE_COLORS.default;

const SLIDE_DURATION = 6000;
const CARDS_PER_PAGE = 3;

// ─── Card individuelle ───────────────────────────────────────

const TestimonialCard = ({ t, index }) => {
    const pc = getPole(t.pole);

    return (
        <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.55, delay: index * 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="relative bg-white rounded-2xl p-6 flex flex-col gap-4 border group transition-all duration-500 hover:-translate-y-1 hover:shadow-[var(--shadow-card-light,0_8px_32px_rgba(0,0,0,0.10))]"
            style={{ borderColor: pc.border }}
        >
            {/* Ligne colorée — apparaît au hover */}
            <div
                className="absolute top-0 left-6 right-6 h-px rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
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
                            className={i < t.rating ? 'fill-amber-400 text-amber-400' : 'fill-transparent text-gray-200'}
                        />
                    ))}
                </div>
            )}

            {/* Citation */}
            <blockquote className="flex-1 relative z-10 font-display-alt italic text-ink-mid leading-relaxed text-[clamp(0.95rem,1.3vw,1.1rem)]">
                &ldquo;{t.comment}&rdquo;
            </blockquote>

            {/* Séparateur */}
            <div className="h-px bg-gray-100" />

            {/* Auteur */}
            <div className="flex items-center gap-3 relative z-10">
                <Image
                    src={
                        t.author?.photo ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(t.author?.name || 'Client')}&background=F3F4F6&color=C8960C&size=80`
                    }
                    alt={t.author?.name || 'Client'}
                    width={36} height={36} unoptimized
                    className="rounded-full object-cover flex-shrink-0 ring-2 ring-white"
                    style={{ boxShadow: `0 0 0 2px ${pc.dot}30` }}
                />
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink truncate leading-tight">
                        {t.author?.name || 'Client'}
                    </p>
                    {t.pole && (
                        <span className="text-xs font-medium" style={{ color: pc.dot }}>
                            {t.pole}
                        </span>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

// ─── Composant principal ─────────────────────────────────────

const Testimonials = () => {
    const [testimonials, setTestimonials] = useState([]);
    const [isLoading,    setIsLoading]    = useState(true);
    const [error,        setError]        = useState(null);
    const [page,         setPage]         = useState(0);
    const timerRef = useRef(null);

    const { user } = useAuth();
    const router   = useRouter();

    useEffect(() => {
        getAllTestimonials(12)
            .then(data => setTestimonials(Array.isArray(data) ? data : []))
            .catch(() => setError('Impossible de charger les avis'))
            .finally(() => setIsLoading(false));
    }, []);

    const totalPages   = Math.ceil(testimonials.length / CARDS_PER_PAGE);
    const visibleCards = testimonials.slice(page * CARDS_PER_PAGE, (page + 1) * CARDS_PER_PAGE);

    const resetTimer = useCallback(() => {
        clearInterval(timerRef.current);
        if (totalPages <= 1) return;
        timerRef.current = setInterval(() => setPage(p => (p + 1) % totalPages), SLIDE_DURATION);
    }, [totalPages]);

    useEffect(() => { resetTimer(); return () => clearInterval(timerRef.current); }, [resetTimer]);

    const prev = () => { setPage(p => (p - 1 + totalPages) % totalPages); resetTimer(); };
    const next = () => { setPage(p => (p + 1) % totalPages); resetTimer(); };

    const handleLeaveReview = () =>
        router.push(user ? '/avis/nouveau' : '/login?from=/avis/nouveau');

    if (isLoading) return (
        <section className="py-16 flex justify-center items-center min-h-[200px] bg-surface">
            <Loader2 className="w-7 h-7 animate-spin text-gold" />
        </section>
    );

    if (error || !testimonials.length) return (
        <section className="py-16 text-center px-6 bg-surface">
            <Star className="w-8 h-8 mx-auto mb-3 text-gray-200" />
            <p className="text-sm text-ink-soft mb-5 font-body">
                {error || "Aucun avis — soyez le premier à partager votre expérience !"}
            </p>
            <button
                onClick={handleLeaveReview}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm bg-gold hover:bg-gold-light text-dark transition-colors"
            >
                <MessageSquarePlus className="w-4 h-4" />
                Laisser un avis
            </button>
        </section>
    );

    return (
        <section className="py-16 sm:py-20 relative overflow-hidden bg-surface">

            {/* Décorations subtiles */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-0 right-0 h-px"
                    style={{ background: 'linear-gradient(to right, transparent, rgba(200,150,12,0.12), transparent)' }} />
                <div className="absolute bottom-0 left-0 right-0 h-px"
                    style={{ background: 'linear-gradient(to right, transparent, rgba(46,123,181,0.12), transparent)' }} />
            </div>

            <div className="container mx-auto px-4 sm:px-6 max-w-7xl relative z-10">

                {/* En-tête */}
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-10">

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                    >
                        <p className="text-xs font-bold uppercase tracking-widest mb-2 text-gold font-body">
                            Témoignages
                        </p>
                        <h2 className="font-display-alt font-light text-ink text-[clamp(1.8rem,3.5vw,4rem)] leading-tight">
                            Ce que disent nos clients
                        </h2>
                        <div className="h-px w-12 mt-3 rounded-full"
                            style={{ background: 'linear-gradient(to right, #C8960C, #2E7BB5)' }} />
                    </motion.div>

                    {/* Contrôles */}
                    <motion.div
                        className="flex items-center gap-4 flex-shrink-0"
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                    >
                        {totalPages > 1 && (
                            <span className="text-sm tabular-nums text-ink-faint font-body">
                                {String(page + 1).padStart(2, '0')} / {String(totalPages).padStart(2, '0')}
                            </span>
                        )}

                        {totalPages > 1 && (
                            <div className="flex gap-2">
                                <button
                                    onClick={prev}
                                    aria-label="Page précédente"
                                    className="w-9 h-9 rounded-full border border-gray-200 bg-white flex items-center justify-center transition-all duration-200 hover:border-gray-300 hover:shadow-sm hover:scale-105"
                                >
                                    <ChevronLeft className="w-4 h-4 text-ink-soft" />
                                </button>
                                <button
                                    onClick={next}
                                    aria-label="Page suivante"
                                    className="w-9 h-9 rounded-full border border-gray-200 bg-white flex items-center justify-center transition-all duration-200 hover:border-gray-300 hover:shadow-sm hover:scale-105"
                                >
                                    <ChevronRight className="w-4 h-4 text-ink-soft" />
                                </button>
                            </div>
                        )}

                        <motion.button
                            onClick={handleLeaveReview}
                            whileHover={{ scale: 1.04 }}
                            whileTap={{ scale: 0.97 }}
                            className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm bg-gold hover:bg-gold-light text-dark transition-colors font-body"
                            style={{ boxShadow: '0 4px 16px rgba(200,150,12,0.22)' }}
                        >
                            <MessageSquarePlus className="w-4 h-4" />
                            Laisser un avis
                        </motion.button>
                    </motion.div>
                </div>

                {/* Grille */}
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
                        {visibleCards.length < CARDS_PER_PAGE &&
                            Array.from({ length: CARDS_PER_PAGE - visibleCards.length }).map((_, i) => (
                                <div key={`ph-${i}`} className="hidden lg:block" />
                            ))
                        }
                    </motion.div>
                </AnimatePresence>

                {/* Dots + CTA mobile */}
                <div className="flex items-center justify-between mt-8">
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
                                        backgroundColor: i === page ? '#C8960C' : '#E5E7EB',
                                    }}
                                />
                            ))}
                        </div>
                    )}

                    <motion.button
                        onClick={handleLeaveReview}
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.97 }}
                        className="sm:hidden inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm bg-gold hover:bg-gold-light text-dark transition-colors font-body ml-auto"
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
