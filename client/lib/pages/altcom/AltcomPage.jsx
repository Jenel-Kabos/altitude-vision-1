"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronLeft, ChevronRight,
    Briefcase, UserRoundPen,
    ArrowRight, Star,
    MessageSquarePlus, CheckCircle, Zap,
} from 'lucide-react';

import HeroSliderAltcom       from '../../components/HeroSliderAltcom';
import AltcomProjectFormModal from '../../components/AltcomProjectFormModal';
import PortfolioCard          from '../../components/PortfolioCard';
import ReviewCard             from '../../components/ReviewCard';
import QuoteModal             from './QuoteModal';
import ServiceCard            from './ServiceCard';

import { createAltcomProject }  from '../../services/altcomService';
import { createQuoteRequest }   from '../../services/quoteService';
import { getAllPortfolioItems }  from '../../services/portfolioService';
import { getAltcomReviews }     from '../../services/reviewService';
import { useAuth }              from '../../context/AuthContext';

import {
    GOLD, GOLD_DARK, GOLD_LIGHT, BLUE,
    SERVICES, ATOUTS, PORTFOLIO_PER_PAGE,
} from './altcomData';

// ─── Skeleton ─────────────────────────────────────────────────
const PortfolioSkeleton = () => (
    <div className="animate-pulse rounded-2xl overflow-hidden"
        style={{ background: '#FFFFFF', border: '1px solid rgba(17,24,39,0.06)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <div style={{ height: '208px', background: '#F3F4F6' }} />
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ height: '14px', background: '#E5E7EB', borderRadius: '6px', width: '70%' }} />
            <div style={{ height: '11px', background: '#F3F4F6', borderRadius: '5px' }} />
            <div style={{ height: '11px', background: '#F3F4F6', borderRadius: '5px', width: '55%' }} />
        </div>
    </div>
);

// ─── Pagination ───────────────────────────────────────────────
const Pagination = ({ totalPages, currentPage, onPageChange }) => {
    if (totalPages <= 1) return null;
    return (
        <div className="flex justify-center items-center gap-2 mt-10">
            <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}
                aria-label="Page précédente"
                className="w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-30"
                style={{ background: '#F3F4F6', border: '1px solid rgba(17,24,39,0.1)' }}>
                <ChevronLeft className="w-4 h-4" style={{ color: '#6B7280' }} aria-hidden="true" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => onPageChange(p)}
                    aria-label={`Page ${p}`}
                    aria-current={p === currentPage ? 'page' : undefined}
                    className="min-w-[36px] h-9 px-3 rounded-full font-semibold text-sm"
                    style={{
                        background: p === currentPage ? `linear-gradient(135deg, ${GOLD_DARK}, ${GOLD})` : '#F3F4F6',
                        color:      p === currentPage ? 'white' : '#6B7280',
                        border:     p === currentPage ? 'none' : '1px solid rgba(17,24,39,0.1)',
                        boxShadow:  p === currentPage ? `0 4px 12px ${GOLD}40` : 'none',
                        transform:  p === currentPage ? 'scale(1.08)' : 'scale(1)',
                        fontFamily: "'DM Sans', sans-serif",
                    }}>
                    {p}
                </button>
            ))}
            <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}
                aria-label="Page suivante"
                className="w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-30"
                style={{ background: '#F3F4F6', border: '1px solid rgba(17,24,39,0.1)' }}>
                <ChevronRight className="w-4 h-4" style={{ color: '#6B7280' }} aria-hidden="true" />
            </button>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────
const AltcomPage = () => {
    const router = useRouter();
    const { user } = useAuth();

    const [loading,        setLoading]        = useState(true);
    const [loadError,      setLoadError]      = useState(false);
    const [portfolio,      setPortfolio]      = useState([]);
    const [reviews,        setReviews]        = useState([]);
    const [reviewsLoading, setReviewsLoading] = useState(true);
    const [showQuoteModal, setShowModal]      = useState(false);
    const [selectedSvc,    setSelectedSvc]    = useState('');
    const [notif,          setNotif]          = useState({ visible: false, msg: '', ok: true });
    const [currentPage,    setCurrentPage]    = useState(1);
    const [showProject,    setShowProject]    = useState(false);

    const openQuote = (svc) => { setSelectedSvc(svc); setShowModal(true); };

    const showNotif = (msg, ok = true) => {
        setNotif({ visible: true, msg, ok });
        setTimeout(() => setNotif({ visible: false, msg: '', ok: true }), 5000);
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const data = await getAllPortfolioItems();
                setPortfolio((data || []).filter(i => i.isPublished && (i.pole === 'Altcom' || !i.pole)));
            } catch { setPortfolio([]); setLoadError(true); }
            finally { setLoading(false); }
        };
        const fetchReviews = async () => {
            try { setReviews((await getAltcomReviews(6)) || []); }
            catch { setReviews([]); }
            finally { setReviewsLoading(false); }
        };
        fetchData();
        fetchReviews();

        if (typeof window !== 'undefined') {
            const historyState = window.history.state;
            const routeState = historyState?.usr ?? historyState;
            if (routeState?.openQuoteModal) {
                openQuote(routeState.service || 'Demande Générale');
                window.history.replaceState({}, document.title);
            } else {
                const urlParams = new URLSearchParams(window.location.search);
                if (urlParams.get('openQuoteModal') === 'true') {
                    openQuote(urlParams.get('service') || 'Demande Générale');
                    urlParams.delete('openQuoteModal');
                    urlParams.delete('service');
                    const newUrl = `${window.location.pathname}${urlParams.toString() ? `?${urlParams.toString()}` : ''}${window.location.hash}`;
                    window.history.replaceState({}, document.title, newUrl);
                }
            }
        }
    }, []);

    const totalPages       = Math.ceil(portfolio.length / PORTFOLIO_PER_PAGE);
    const currentPortfolio = useMemo(
        () => portfolio.slice((currentPage - 1) * PORTFOLIO_PER_PAGE, currentPage * PORTFOLIO_PER_PAGE),
        [portfolio, currentPage]
    );

    const handleQuoteSubmit   = async (fd) => {
        await createQuoteRequest(fd);
        showNotif(`Demande pour "${fd.service}" enregistrée. Réponse sous 24h !`);
    };
    const handleProjectSubmit = async (fd) => {
        try {
            await createAltcomProject(fd);
            showNotif(`Projet "${fd.projectName}" soumis avec succès.`);
        } catch (err) {
            const m = err.response?.data?.message || err.message || 'Erreur.';
            showNotif(m, false);
            throw err;
        }
    };

    const handleLeaveReview = () =>
        router.push(user ? '/avis/nouveau' : '/login');

    return (
        <div style={{ minHeight: '100vh', background: '#F8F8F8', fontFamily: "'DM Sans', sans-serif" }}>

            {/* Toast */}
            <AnimatePresence>
                {notif.visible && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="fixed top-20 right-4 z-50 px-5 py-3.5 rounded-2xl shadow-2xl text-white text-sm font-semibold max-w-sm"
                        style={{
                            background:  notif.ok
                                ? 'linear-gradient(135deg,#16a34a,#15803d)'
                                : 'linear-gradient(135deg,#D42B2B,#A01E1E)',
                            fontFamily: "'DM Sans', sans-serif",
                        }}>
                        {notif.msg}
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showQuoteModal && (
                    <QuoteModal
                        serviceTitle={selectedSvc}
                        onClose={() => setShowModal(false)}
                        onSubmit={handleQuoteSubmit}
                    />
                )}
            </AnimatePresence>

            {showProject && (
                <AltcomProjectFormModal
                    onClose={() => setShowProject(false)}
                    onFormSubmit={handleProjectSubmit}
                />
            )}

            {/* ══ HERO ═════════════════════════════════════════════════ */}
            <header className="relative text-white overflow-hidden"
                style={{ height: '100svh', minHeight: '620px', maxHeight: '860px' }}>
                <HeroSliderAltcom onStartProject={() => setShowProject(true)} />
                <div className="absolute bottom-0 left-0 right-0" style={{ zIndex: 10 }}>
                    <div className="h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.07), transparent)' }} />
                    <div style={{ backdropFilter: 'blur(12px)', background: 'rgba(0,0,0,0.35)', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)' }}
                        className="sm:grid-cols-4">
                        {ATOUTS.map(({ icon: Icon, label, color }, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
                                <Icon style={{ width: '14px', height: '14px', color, flexShrink: 0 }} />
                                <span style={{ color: 'rgba(255,255,255,0.88)', fontSize: '0.76rem' }}>{label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </header>

            {/* ══ À PROPOS ═════════════════════════════════════════════ */}
            <section style={{ padding: 'clamp(52px,9vw,96px) 0', background: '#F8F8F8', position: 'relative', overflow: 'hidden' }}>
                <div className="absolute top-0 left-0 right-0 h-px"
                    style={{ background: `linear-gradient(to right, transparent, ${GOLD}22, transparent)` }} />
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <div className="lg:grid lg:grid-cols-2 lg:gap-16 lg:items-center">
                        <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }} transition={{ duration: 0.7 }} className="mb-12 lg:mb-0">
                            <p style={{ fontSize: '0.76rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: GOLD, marginBottom: '12px', fontFamily: "'DM Sans', sans-serif" }}>
                                Notre approche
                            </p>
                            <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(2rem, 4vw, 4.5rem)', fontWeight: 300, lineHeight: 1.08, color: '#111827', marginBottom: '16px' }}>
                                Qui Sommes-Nous ?
                            </h2>
                            <div style={{ height: '2px', width: '48px', borderRadius: '2px', marginBottom: '22px', background: `linear-gradient(to right, ${GOLD}, ${BLUE})` }} />
                            <p style={{ color: '#374151', lineHeight: 1.75, marginBottom: '20px', fontSize: 'clamp(0.9rem,2vw,1rem)' }}>
                                Altcom est le pôle de communication d'Altitude-Vision, spécialisé dans la création de{' '}
                                <strong style={{ color: '#111827' }}>stratégies percutantes</strong> à Brazzaville. Nous aidons les marques à raconter leur histoire et à{' '}
                                <strong style={{ color: '#111827' }}>engager leur audience</strong> grâce à des solutions créatives et sur mesure.
                            </p>
                            <ul style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
                                {[
                                    'Stratégie de communication 360°',
                                    'Création de contenus visuels et digitaux',
                                    'Gestion des réseaux sociaux',
                                    'Couverture médiatique professionnelle',
                                ].map((item, i) => (
                                    <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', color: '#374151' }}>
                                        <CheckCircle style={{ width: '14px', height: '14px', color: GOLD, flexShrink: 0 }} />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                            <button onClick={() => setShowProject(true)}
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-white text-sm group"
                                style={{ background: `linear-gradient(135deg, ${GOLD_DARK}, ${GOLD})`, boxShadow: `0 4px 20px ${GOLD}4D`, fontFamily: "'DM Sans', sans-serif", border: 'none', cursor: 'pointer' }}>
                                Démarrer un projet
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </motion.div>

                        <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.1 }}
                            className="grid grid-cols-2 gap-4">
                            {[
                                { value: '80+',   label: 'Projets réalisés',   color: GOLD },
                                { value: '98%',   label: 'Clients satisfaits', color: BLUE },
                                { value: '5 ans', label: "D'expérience",       color: GOLD },
                                { value: '24h',   label: 'Délai de réponse',   color: BLUE },
                            ].map(({ value, label, color }, i) => (
                                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }} transition={{ delay: 0.2 + i * 0.1 }}
                                    style={{ padding: 'clamp(18px,3.5vw,26px)', borderRadius: '10px', textAlign: 'center', background: '#FFFFFF', border: `1px solid ${color}20`, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                                    <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(2rem,6vw,4rem)', fontWeight: 300, color, lineHeight: 1, marginBottom: '6px' }}>
                                        {value}
                                    </p>
                                    <p style={{ fontSize: '0.74rem', color: '#4B5563', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500 }}>
                                        {label}
                                    </p>
                                </motion.div>
                            ))}
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* ══ SERVICES ═════════════════════════════════════════════ */}
            <section style={{ padding: 'clamp(52px,9vw,96px) 0', background: '#FFFFFF', position: 'relative' }}>
                <div className="absolute top-0 left-0 right-0 h-px"
                    style={{ background: `linear-gradient(to right, transparent, rgba(17,24,39,0.06), transparent)` }} />
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <motion.div className="text-center mb-12"
                        initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }} transition={{ duration: 0.6 }}>
                        <p style={{ fontSize: '0.76rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: GOLD, marginBottom: '10px', fontFamily: "'DM Sans', sans-serif" }}>
                            Nos Expertises
                        </p>
                        <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(2rem, 4vw, 4.5rem)', fontWeight: 300, lineHeight: 1.08, color: '#111827', marginBottom: '8px' }}>
                            Nos Services
                        </h2>
                        <p style={{ fontSize: '0.85rem', color: '#6B7280', maxWidth: '480px', margin: '0 auto' }}>
                            Des solutions sur mesure pour amplifier votre message et engager votre audience
                        </p>
                    </motion.div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'clamp(16px, 2vw, 24px)' }}>
                        {SERVICES.map((s, i) => <ServiceCard key={s._id} service={s} onQuote={openQuote} index={i} />)}
                    </div>
                </div>
            </section>

            {/* ══ PORTFOLIO ════════════════════════════════════════════ */}
            <section id="portfolio" style={{ padding: 'clamp(52px,9vw,96px) 0', background: '#F8F8F8', position: 'relative' }}>
                <div className="absolute top-0 left-0 right-0 h-px"
                    style={{ background: `linear-gradient(to right, transparent, rgba(17,24,39,0.06), transparent)` }} />
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
                        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                            <p style={{ fontSize: '0.76rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: GOLD, marginBottom: '8px', fontFamily: "'DM Sans', sans-serif" }}>
                                Portfolio
                            </p>
                            <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(1.8rem, 3.5vw, 4rem)', fontWeight: 300, lineHeight: 1.1, color: '#111827' }}>
                                Nos Réalisations
                            </h2>
                        </motion.div>
                        <Link href="/communication/annonces"
                            className="inline-flex items-center gap-2 text-sm font-semibold group flex-shrink-0"
                            style={{ color: GOLD }}>
                            Voir tous les projets <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </Link>
                    </div>

                    {loadError && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', background: `${GOLD}08`, border: `1px solid ${GOLD}22`, fontSize: '0.82rem', color: '#6B7280' }}>
                            ⚠️ Impossible de charger les projets pour le moment. Réessayez plus tard.
                        </div>
                    )}
                    {loading ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'clamp(16px, 2vw, 24px)' }}>
                            {[1,2,3].map(i => <PortfolioSkeleton key={i} />)}
                        </div>
                    ) : currentPortfolio.length > 0 ? (
                        <>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'clamp(16px, 2vw, 24px)' }}>
                                {currentPortfolio.map((item, i) => (
                                    <motion.div key={item._id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true, amount: 0.1 }} transition={{ duration: 0.4, delay: i * 0.05 }}>
                                        <PortfolioCard item={item} />
                                    </motion.div>
                                ))}
                            </div>
                            <Pagination totalPages={totalPages} currentPage={currentPage}
                                onPageChange={p => {
                                    setCurrentPage(p);
                                    document.getElementById('portfolio')?.scrollIntoView({ behavior: 'smooth' });
                                }} />
                        </>
                    ) : (
                        <div className="text-center py-16 rounded-2xl"
                            style={{ border: `1px dashed ${GOLD}30`, background: `${GOLD}06` }}>
                            <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4"
                                style={{ background: `linear-gradient(135deg, ${GOLD_DARK}, ${GOLD})` }}>
                                <Briefcase className="w-7 h-7 text-white" />
                            </div>
                            <p style={{ fontWeight: 600, color: '#374151', marginBottom: '4px' }}>Aucune réalisation disponible</p>
                            <p style={{ fontSize: '0.85rem', color: '#6B7280' }}>Nos premiers projets arrivent bientôt</p>
                        </div>
                    )}
                </div>
            </section>

            {/* ══ AVIS ═════════════════════════════════════════════════ */}
            <section style={{ padding: 'clamp(52px,9vw,96px) 0', background: '#FFFFFF', position: 'relative' }}>
                <div className="absolute top-0 left-0 right-0 h-px"
                    style={{ background: `linear-gradient(to right, transparent, rgba(17,24,39,0.06), transparent)` }} />
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
                        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                            <p style={{ fontSize: '0.76rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: GOLD, marginBottom: '8px', fontFamily: "'DM Sans', sans-serif" }}>
                                Témoignages
                            </p>
                            <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(1.8rem, 3.5vw, 4rem)', fontWeight: 300, lineHeight: 1.1, color: '#111827' }}>
                                Ils Nous Font Confiance
                            </h2>
                        </motion.div>
                        <motion.button onClick={handleLeaveReview} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-white text-sm flex-shrink-0"
                            style={{ background: `linear-gradient(135deg, ${GOLD_DARK}, ${GOLD})`, boxShadow: `0 4px 16px ${GOLD}4D`, fontFamily: "'DM Sans', sans-serif", border: 'none', cursor: 'pointer' }}>
                            <MessageSquarePlus className="w-4 h-4" />
                            Laisser un avis
                            {!user && <span style={{ opacity: 0.70, fontSize: '0.70rem', fontWeight: 400 }}>(connexion)</span>}
                        </motion.button>
                    </div>

                    {reviewsLoading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            {[1,2,3].map(i => (
                                <div key={i} className="rounded-2xl p-6 animate-pulse"
                                    style={{ background: '#FFFFFF', border: '1px solid rgba(17,24,39,0.06)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                                    <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                                        <div style={{ width: '36px', height: '36px', background: '#E5E7EB', borderRadius: '50%', flexShrink: 0 }} />
                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '7px' }}>
                                            <div style={{ height: '11px', background: '#E5E7EB', borderRadius: '5px', width: '58%' }} />
                                            <div style={{ height: '9px', background: '#F3F4F6', borderRadius: '4px', width: '32%' }} />
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                                        <div style={{ height: '11px', background: '#F3F4F6', borderRadius: '5px' }} />
                                        <div style={{ height: '11px', background: '#F3F4F6', borderRadius: '5px', width: '78%' }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : reviews.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {reviews.map((review, i) => (
                                <motion.div key={review._id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.08 }}>
                                    <ReviewCard review={review} />
                                </motion.div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-14 rounded-2xl"
                            style={{ border: `1px dashed ${GOLD}28`, background: `${GOLD}06` }}>
                            <Star className="w-8 h-8 mx-auto mb-3" style={{ color: '#D1D5DB' }} />
                            <p style={{ fontWeight: 600, color: '#374151', marginBottom: '4px' }}>Aucun avis pour le moment</p>
                            <p style={{ fontSize: '0.85rem', color: '#6B7280' }}>Soyez le premier à partager votre expérience !</p>
                        </div>
                    )}
                </div>
            </section>

            {/* ══ CTA FINAL ════════════════════════════════════════════ */}
            <section style={{ padding: 'clamp(52px,9vw,96px) 0', position: 'relative', overflow: 'hidden', background: '#F8F8F8' }}>
                <div className="absolute top-0 left-0 right-0 h-px"
                    style={{ background: `linear-gradient(to right, transparent, ${GOLD}30, transparent)` }} />
                <div className="container mx-auto px-4 sm:px-6 max-w-4xl text-center" style={{ position: 'relative', zIndex: 10 }}>
                    <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-6"
                            style={{ background: `linear-gradient(135deg, ${GOLD_DARK}, ${GOLD})` }}>
                            <Zap className="w-7 h-7 text-white" />
                        </div>
                        <p style={{ fontSize: '0.76rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: GOLD, marginBottom: '14px', fontFamily: "'DM Sans', sans-serif" }}>
                            Propulsez votre marque
                        </p>
                        <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(2rem, 4vw, 4.5rem)', fontWeight: 300, lineHeight: 1.08, color: '#111827', marginBottom: '16px' }}>
                            Prêt à Propulser Votre Marque ?
                        </h2>
                        <p style={{ color: '#6B7280', marginBottom: '36px', maxWidth: '540px', margin: '0 auto 36px', lineHeight: 1.7, fontSize: 'clamp(0.9rem, 1.5vw, 1rem)' }}>
                            Discutons de votre stratégie de communication pour atteindre de nouveaux sommets ensemble.
                        </p>
                        <div className="flex flex-wrap justify-center gap-4">
                            <motion.button onClick={() => openQuote('Projet Sur Mesure')}
                                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
                                className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-semibold text-white text-base"
                                style={{ background: `linear-gradient(135deg, ${GOLD_DARK}, ${GOLD})`, boxShadow: `0 8px 32px ${GOLD}66`, fontFamily: "'DM Sans', sans-serif", border: 'none', cursor: 'pointer' }}>
                                <UserRoundPen className="w-5 h-5" /> Contacter l'équipe Altcom
                            </motion.button>
                            <Link href="/communication/annonces"
                                className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-semibold text-base hover:bg-gray-100 transition-all"
                                style={{ color: '#374151', border: '1px solid rgba(17,24,39,0.15)', fontFamily: "'DM Sans', sans-serif" }}>
                                <Briefcase className="w-5 h-5" /> Voir nos projets
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </section>
        </div>
    );
};

export default AltcomPage;
