"use client";
// src/pages/altcom/AltcomPage.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Loader2, ChevronLeft, ChevronRight,
    Briefcase, Presentation, UserRoundPen,
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
    <div className="animate-pulse bg-white rounded-3xl overflow-hidden border border-gray-100">
        <div className="bg-gray-200 h-52" />
        <div className="p-5 space-y-3">
            <div className="h-4 bg-gray-100 rounded-full w-3/4" />
            <div className="h-3 bg-gray-100 rounded-full w-full" />
            <div className="h-3 bg-gray-100 rounded-full w-2/3" />
        </div>
    </div>
);

// ─── Pagination ───────────────────────────────────────────────
const Pagination = ({ totalPages, currentPage, onPageChange }) => {
    if (totalPages <= 1) return null;
    return (
        <div className="flex justify-center items-center gap-2 mt-12">
            <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}
                className="w-9 h-9 rounded-full border border-gray-200 bg-white flex items-center justify-center disabled:opacity-30 hover:bg-gray-50 transition-all">
                <ChevronLeft className="w-4 h-4 text-gray-500" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => onPageChange(p)}
                    className="min-w-[36px] h-9 px-3 rounded-full font-semibold text-sm transition-all"
                    style={{
                        background: p === currentPage ? `linear-gradient(135deg, ${GOLD_DARK}, ${GOLD})` : 'white',
                        color:      p === currentPage ? 'white' : '#6B7280',
                        border:     `1px solid ${p === currentPage ? 'transparent' : '#E5E7EB'}`,
                        boxShadow:  p === currentPage ? `0 4px 12px ${GOLD}40` : 'none',
                        fontFamily: "'Outfit', sans-serif",
                    }}>
                    {p}
                </button>
            ))}
            <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}
                className="w-9 h-9 rounded-full border border-gray-200 bg-white flex items-center justify-center disabled:opacity-30 hover:bg-gray-50 transition-all">
                <ChevronRight className="w-4 h-4 text-gray-500" />
            </button>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────
const AltcomPage = () => {
    const router = useRouter();
    const { user } = useAuth();

    const [loading,        setLoading]        = useState(true);
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
            } catch { setPortfolio([]); }
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
        <div className="min-h-screen bg-white" style={{ fontFamily: "'Outfit', sans-serif" }}>


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
                            fontFamily: "'Outfit', sans-serif",
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

            <AnimatePresence>
                {showProject && (
                    <AltcomProjectFormModal
                        onClose={() => setShowProject(false)}
                        onFormSubmit={handleProjectSubmit}
                    />
                )}
            </AnimatePresence>

            {/* ══ HERO ═════════════════════════════════════════════════
                Le HeroSliderAltcom gère tout le contenu narratif.
                Cette section ne contient que :
                - Le slider en fond
                - Deux CTAs flottants en bas (avant la bande atouts)
                - La bande d'atouts
            ════════════════════════════════════════════════════════ */}
            <header className="relative text-white overflow-hidden"
                style={{ height: 'calc(100vh - 0px)', minHeight: '640px', maxHeight: '860px' }}>

                {/* Slider narratif — contient tout le texte */}
                <HeroSliderAltcom />

                {/* ── Bande atouts bas du hero ─────────────────────── */}
                <div className="absolute bottom-0 left-0 right-0" style={{ zIndex: 10 }}>
                    <div className="h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.08), transparent)' }} />
                    <div className="backdrop-blur-md bg-black/30 grid grid-cols-2 sm:grid-cols-4 divide-x divide-white/10">
                        {ATOUTS.map(({ icon: Icon, label, color }, i) => (
                            <div key={i} className="flex items-center gap-2.5 px-5 py-3.5">
                                <Icon className="w-4 h-4 flex-shrink-0" style={{ color }} aria-hidden="true" />
                                <span className="text-white/70 text-xs font-medium">{label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </header>

            {/* ══ À PROPOS ═════════════════════════════════════════════ */}
            <section className="py-20 sm:py-24 bg-white overflow-hidden">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <div className="lg:grid lg:grid-cols-2 lg:gap-16 lg:items-center">
                        <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }} transition={{ duration: 0.7 }} className="mb-12 lg:mb-0">
                            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: GOLD }}>Notre approche</p>
                            <h2 className="text-gray-900 mb-5"
                                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(2rem, 4vw, 3.2rem)', fontWeight: 700, lineHeight: 1.1 }}>
                                Qui Sommes-Nous ?
                            </h2>
                            <div className="h-0.5 w-16 rounded-full mb-6" style={{ background: `linear-gradient(to right, ${GOLD}, ${BLUE})` }} />
                            <p className="text-gray-600 leading-relaxed mb-6 text-base sm:text-lg">
                                Altcom est le pôle de communication d'Altitude-Vision, spécialisé dans la création de{' '}
                                <span className="font-semibold text-gray-900">stratégies percutantes</span> à Brazzaville. Nous aidons les marques à raconter leur histoire et à{' '}
                                <span className="font-semibold text-gray-900">engager leur audience</span> grâce à des solutions créatives et sur mesure.
                            </p>
                            <ul className="space-y-2.5 mb-8">
                                {[
                                    'Stratégie de communication 360°',
                                    'Création de contenus visuels et digitaux',
                                    'Gestion des réseaux sociaux',
                                    'Couverture médiatique professionnelle',
                                ].map((item, i) => (
                                    <li key={i} className="flex items-center gap-3 text-sm text-gray-600">
                                        <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: GOLD }} />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                            <button onClick={() => setShowProject(true)}
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-white text-sm transition-all hover:scale-105 hover:shadow-xl group"
                                style={{ background: `linear-gradient(135deg, ${GOLD_DARK}, ${GOLD})`, boxShadow: `0 4px 20px ${GOLD}30`, fontFamily: "'Outfit', sans-serif" }}>
                                Démarrer un projet
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </motion.div>

                        <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.1 }}
                            className="grid grid-cols-2 gap-4">
                            {[
                                { value: '80+',  label: 'Projets réalisés',   color: GOLD },
                                { value: '98%',  label: 'Clients satisfaits', color: BLUE },
                                { value: '5 ans',label: "D'expérience",       color: GOLD },
                                { value: '24h',  label: 'Délai de réponse',   color: BLUE },
                            ].map(({ value, label, color }, i) => (
                                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }} transition={{ delay: 0.2 + i * 0.1 }}
                                    className="p-6 rounded-2xl border text-center"
                                    style={{ backgroundColor: `${color}08`, borderColor: `${color}20` }}>
                                    <p className="mb-1"
                                        style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.5rem', fontWeight: 700, color, lineHeight: 1 }}>
                                        {value}
                                    </p>
                                    <p className="text-xs text-gray-500 font-medium">{label}</p>
                                </motion.div>
                            ))}
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* ══ SERVICES ═════════════════════════════════════════════ */}
            <section className="py-16 sm:py-20 bg-gray-50">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <motion.div className="text-center mb-12"
                        initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }} transition={{ duration: 0.6 }}>
                        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: GOLD }}>Nos Expertises</p>
                        <h2 className="text-gray-900 mb-3"
                            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 700, lineHeight: 1.1 }}>
                            Nos Services
                        </h2>
                        <p className="text-gray-500 text-sm max-w-xl mx-auto">
                            Des solutions sur mesure pour amplifier votre message et engager votre audience
                        </p>
                    </motion.div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                        {SERVICES.map((s, i) => <ServiceCard key={s._id} service={s} onQuote={openQuote} index={i} />)}
                    </div>
                </div>
            </section>

            {/* ══ PORTFOLIO ════════════════════════════════════════════ */}
            <section id="portfolio" className="py-16 sm:py-20 bg-white">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
                        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: GOLD }}>Portfolio</p>
                            <h2 className="text-gray-900"
                                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)', fontWeight: 700, lineHeight: 1.1 }}>
                                Nos Réalisations
                            </h2>
                        </motion.div>
                        <Link href="/altcom/annonces"
                            className="inline-flex items-center gap-2 text-sm font-semibold group flex-shrink-0"
                            style={{ color: GOLD }}>
                            Voir tous les projets <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </Link>
                    </div>

                    {loading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            {[1,2,3].map(i => <PortfolioSkeleton key={i} />)}
                        </div>
                    ) : currentPortfolio.length > 0 ? (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
                        <div className="text-center py-16 rounded-3xl border border-dashed"
                            style={{ borderColor: `${GOLD}30`, backgroundColor: `${GOLD}04` }}>
                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                                style={{ background: `linear-gradient(135deg, ${GOLD_DARK}, ${GOLD})` }}>
                                <Briefcase className="w-8 h-8 text-white" />
                            </div>
                            <p className="font-bold text-gray-700 mb-1">Aucune réalisation disponible</p>
                            <p className="text-sm text-gray-500">Nos premiers projets arrivent bientôt</p>
                        </div>
                    )}
                </div>
            </section>

            {/* ══ AVIS ═════════════════════════════════════════════════ */}
            <section className="py-16 sm:py-20 bg-gray-50">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
                        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: GOLD }}>Témoignages</p>
                            <h2 className="text-gray-900"
                                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)', fontWeight: 700, lineHeight: 1.1 }}>
                                Ils Nous Font Confiance
                            </h2>
                        </motion.div>
                        <motion.button onClick={handleLeaveReview} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-white text-sm flex-shrink-0"
                            style={{ background: `linear-gradient(135deg, ${GOLD_DARK}, ${GOLD})`, boxShadow: `0 4px 16px ${GOLD}30`, fontFamily: "'Outfit', sans-serif" }}>
                            <MessageSquarePlus className="w-4 h-4" />
                            Laisser un avis
                            {!user && <span className="opacity-50 text-xs font-normal">(connexion)</span>}
                        </motion.button>
                    </div>

                    {reviewsLoading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            {[1,2,3].map(i => (
                                <div key={i} className="animate-pulse bg-white rounded-3xl p-6 border border-gray-100">
                                    <div className="flex gap-3 mb-4">
                                        <div className="w-10 h-10 bg-gray-200 rounded-full flex-shrink-0" />
                                        <div className="flex-1 space-y-2">
                                            <div className="h-3 bg-gray-200 rounded-full w-2/3" />
                                            <div className="h-2 bg-gray-100 rounded-full w-1/3" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="h-3 bg-gray-100 rounded-full" />
                                        <div className="h-3 bg-gray-100 rounded-full w-4/5" />
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
                        <div className="text-center py-14 rounded-3xl border border-dashed"
                            style={{ borderColor: `${GOLD}25`, backgroundColor: `${GOLD}03` }}>
                            <Star className="w-8 h-8 mx-auto mb-3 text-gray-300" />
                            <p className="font-bold text-gray-700 mb-1">Aucun avis pour le moment</p>
                            <p className="text-sm text-gray-500">Soyez le premier à partager votre expérience !</p>
                        </div>
                    )}
                </div>
            </section>

            {/* ══ CTA FINAL ════════════════════════════════════════════ */}
            <section className="py-20 relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #0D1117 0%, #1a1505 50%, #0D1117 100%)' }}>
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-0 left-1/4 w-80 h-80 rounded-full blur-[120px] opacity-15" style={{ background: GOLD }} />
                    <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full blur-[120px] opacity-8"  style={{ background: BLUE }} />
                </div>
                <div className="absolute top-0 left-0 right-0 h-px"
                    style={{ background: `linear-gradient(to right, transparent, ${GOLD}50, transparent)` }} />

                <div className="container mx-auto px-4 sm:px-6 max-w-4xl text-center relative z-10">
                    <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-6"
                            style={{ background: `linear-gradient(135deg, ${GOLD_DARK}, ${GOLD})` }}>
                            <Zap className="w-7 h-7 text-white" />
                        </div>
                        <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: GOLD_LIGHT }}>Propulsez votre marque</p>
                        <h2 className="text-white mb-5"
                            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(2rem, 4vw, 3.5rem)', fontWeight: 700, lineHeight: 1.1 }}>
                            Prêt à Propulser Votre Marque ?
                        </h2>
                        <p className="text-white/60 mb-10 max-w-2xl mx-auto leading-relaxed"
                            style={{ fontSize: 'clamp(0.95rem, 1.5vw, 1.1rem)' }}>
                            Discutons de votre stratégie de communication pour atteindre de nouveaux sommets ensemble.
                        </p>
                        <div className="flex flex-wrap justify-center gap-4">
                            <motion.button onClick={() => openQuote('Projet Sur Mesure')}
                                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
                                className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-semibold text-white text-base"
                                style={{ background: `linear-gradient(135deg, ${GOLD_DARK}, ${GOLD})`, boxShadow: `0 8px 32px ${GOLD}40`, fontFamily: "'Outfit', sans-serif" }}>
                                <UserRoundPen className="w-5 h-5" /> Contacter l'équipe Altcom
                            </motion.button>
                            <Link href="/altcom/annonces"
                                className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-semibold text-white/80 text-base border border-white/15 hover:bg-white/10 transition-all"
                                style={{ fontFamily: "'Outfit', sans-serif" }}>
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