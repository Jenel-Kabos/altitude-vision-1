import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    MessageSquare, Layout, TrendingUp, Zap,
    Loader2, X, ChevronLeft, ChevronRight,
    Send, Briefcase, Presentation, UserRoundPen,
    ArrowRight, Sparkles, Radio, Star,
    MessageSquarePlus, CheckCircle, Target, Camera,
} from 'lucide-react';

import HeroSliderAltcom          from '../components/HeroSliderAltcom';
import { createAltcomProject }   from '../services/altcomService';
import { createQuoteRequest }    from '../services/quoteService';
import { getAllPortfolioItems }   from '../services/portfolioService';
import { getAltcomReviews }      from '../services/reviewService';
import { useAuth }               from '../context/AuthContext';
import PortfolioCard             from '../components/PortfolioCard';
import ReviewCard                from '../components/ReviewCard';
import AltcomProjectFormModal    from '../components/AltcomProjectFormModal';
import SEOHead                       from '../components/SEOHead';

// ─────────────────────────────────────────────────────────────
// Couleurs Altcom
// ─────────────────────────────────────────────────────────────
const GOLD      = '#C8872A';
const GOLD_DARK = '#A06820';
const GOLD_LIGHT= '#E5A84B';
const BLUE      = '#2E7BB5';

// ─────────────────────────────────────────────────────────────
// Données statiques
// ─────────────────────────────────────────────────────────────
const DEFAULT_SERVICES = [
    {
        _id: 1, icon: MessageSquare,
        title: 'Communication Digitale',
        desc: 'Création de contenus et campagnes sur mesure pour le web et les réseaux sociaux.',
        stat: 'Web & Social',
        color: GOLD,
        route: '/altcom/service/1',
    },
    {
        _id: 2, icon: Layout,
        title: 'Branding & Design',
        desc: "Définition d'identité visuelle et supports graphiques professionnels.",
        stat: 'Identité visuelle',
        color: BLUE,
        route: '/altcom/service/2',
    },
    {
        _id: 3, icon: TrendingUp,
        title: 'Conseil & Stratégie',
        desc: 'Accompagnement stratégique pour optimiser votre communication.',
        stat: 'Stratégie 360°',
        color: GOLD,
        route: '/altcom/service/3',
    },
    {
        _id: 4, icon: Camera,
        title: 'Couverture Médiatique',
        desc: 'Organisation et couverture complète de vos événements avec reportage photo/vidéo.',
        stat: 'Photo & Vidéo',
        color: BLUE,
        route: '/altcom/couverture-mediatique',
    },
];

const ATOUTS = [
    { icon: Target,       label: 'Stratégie ciblée',     color: GOLD },
    { icon: Sparkles,     label: 'Créativité sur mesure', color: GOLD },
    { icon: Camera,       label: 'Production visuelle',   color: BLUE },
    { icon: TrendingUp,   label: 'Résultats mesurables',  color: GOLD },
];

const PROJECT_TYPES = [
    'Communication Digitale', 'Branding & Design', 'Stratégie de Contenu',
    'Campagne Publicitaire', 'Refonte Site Web', 'Couverture Médiatique', 'Autre',
];

const BUDGETS = [
    { v: '',          l: 'Non précisé' },
    { v: 'Moins de 1M', l: 'Moins de 1 000 000 FCFA' },
    { v: '1M-5M',     l: '1M – 5M FCFA' },
    { v: '5M-10M',    l: '5M – 10M FCFA' },
    { v: 'Plus de 10M',l: 'Plus de 10M FCFA' },
];

const PORTFOLIO_PER_PAGE = 6;

// ─────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// Service card
// ─────────────────────────────────────────────────────────────
const ServiceCard = ({ service, onQuote, index }) => {
    const navigate = useNavigate();
    const Icon = service.icon;

    return (
      
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            whileHover={{ y: -6 }}
            className="group relative bg-white rounded-3xl p-7 border flex flex-col h-full transition-all duration-500 hover:shadow-xl overflow-hidden"
            style={{ borderColor: `${service.color}20` }}

            
        >
            {/* Ligne colorée haut */}
            <div className="absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ backgroundColor: service.color }} />

                <SEOHead
  title="Altcom — Communication & Branding"
  description="Altcom by Altitude-Vision : stratégie digitale, branding, campagnes publicitaires et production audiovisuelle au Congo."
  url="/altcom"
/>
            {/* Halo fond */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: `radial-gradient(circle at 30% 50%, ${service.color}08, transparent 70%)` }} />

            {/* Icône */}
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110 relative z-10"
                style={{ backgroundColor: `${service.color}15`, border: `1px solid ${service.color}25` }}>
                <Icon className="w-6 h-6" style={{ color: service.color }} />
            </div>

            {/* Badge stat */}
            <span className="inline-block text-xs font-bold px-2.5 py-1 rounded-full mb-3 relative z-10"
                style={{ backgroundColor: `${service.color}12`, color: service.color, fontFamily: "'Outfit', sans-serif" }}>
                {service.stat}
            </span>

            <h3 className="font-bold text-gray-900 text-lg mb-2 relative z-10 transition-colors duration-200 group-hover:text-[#C8872A]"
                style={{ fontFamily: "'Outfit', sans-serif" }}>
                {service.title}
            </h3>
            <p className="text-gray-500 text-sm leading-relaxed mb-5 flex-1 relative z-10"
                style={{ fontFamily: "'Outfit', sans-serif" }}>
                {service.desc}
            </p>

            <div className="space-y-2.5 relative z-10 mt-auto">
              
                <motion.button
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={() => onQuote(service.title)}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white text-sm transition-all"
                    style={{
                        background: `linear-gradient(135deg, ${GOLD_DARK}, ${GOLD})`,
                        boxShadow:  `0 4px 16px ${GOLD}30`,
                        fontFamily: "'Outfit', sans-serif",
                    }}>
                    <Send className="w-4 h-4" />
                    Demander un devis
                </motion.button>
                <button onClick={() => navigate(service.route)}
                    className="w-full flex items-center justify-center gap-2 text-sm font-semibold transition-all group-hover:gap-3"
                    style={{ color: service.color, fontFamily: "'Outfit', sans-serif" }}>
                    Détails du service
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </button>
            </div>
        </motion.div>
    );
};

// ─────────────────────────────────────────────────────────────
// Pagination
// ─────────────────────────────────────────────────────────────
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
                        background:  p === currentPage ? `linear-gradient(135deg, ${GOLD_DARK}, ${GOLD})` : 'white',
                        color:       p === currentPage ? 'white' : '#6B7280',
                        border:      `1px solid ${p === currentPage ? 'transparent' : '#E5E7EB'}`,
                        boxShadow:   p === currentPage ? `0 4px 12px ${GOLD}40` : 'none',
                        fontFamily:  "'Outfit', sans-serif",
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
// Modal devis
// ─────────────────────────────────────────────────────────────
const QuoteModal = ({ serviceTitle, onClose, onSubmit }) => {
    const [form, setForm] = useState({
        name: '', email: '', phone: '', service: serviceTitle,
        projectType: 'Communication Digitale', budget: '', description: '',
        source: 'Altcom',
    });
    const [loading, setLoading] = useState(false);
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name || !form.email || !form.description || !form.projectType) {
            alert('Veuillez remplir tous les champs obligatoires.');
            return;
        }
        setLoading(true);
        try { await onSubmit(form); onClose(); }
        catch (err) { alert(err.message || "Erreur lors de l'envoi."); }
        finally { setLoading(false); }
    };

    const inputCls = "w-full px-4 py-3 border border-gray-200 rounded-2xl bg-gray-50 text-gray-900 text-sm transition-all focus:outline-none focus:bg-white placeholder-gray-400";
    const focusGold = e => { e.target.style.borderColor = GOLD; e.target.style.boxShadow = `0 0 0 3px ${GOLD}15`; };
    const blurGold  = e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; };

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 40 }}
                className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl relative max-h-[92vh] overflow-y-auto"
            >
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-100 px-7 py-5 flex items-center justify-between z-10 rounded-t-3xl">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                            style={{ background: `linear-gradient(135deg, ${GOLD_DARK}, ${GOLD})` }}>
                            <MessageSquare className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 text-lg leading-tight"
                                style={{ fontFamily: "'Outfit', sans-serif" }}>
                                Demander un devis
                            </h3>
                            <p className="text-xs text-gray-400" style={{ fontFamily: "'Outfit', sans-serif" }}>
                                {serviceTitle}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} disabled={loading}
                        className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                        <X className="w-4 h-4 text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-7 space-y-4">
                    {/* Type projet */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5"
                            style={{ fontFamily: "'Outfit', sans-serif" }}>
                            Type de projet <span className="text-red-400">*</span>
                        </label>
                        <select value={form.projectType} onChange={e => set('projectType', e.target.value)}
                            className={inputCls} style={{ fontFamily: "'Outfit', sans-serif" }}
                            onFocus={focusGold} onBlur={blurGold}>
                            {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>

                    {/* Nom + Email */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5"
                                style={{ fontFamily: "'Outfit', sans-serif" }}>
                                Nom complet <span className="text-red-400">*</span>
                            </label>
                            <input type="text" placeholder="Votre nom"
                                value={form.name} onChange={e => set('name', e.target.value)}
                                required className={inputCls} style={{ fontFamily: "'Outfit', sans-serif" }}
                                onFocus={focusGold} onBlur={blurGold} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5"
                                style={{ fontFamily: "'Outfit', sans-serif" }}>
                                Email <span className="text-red-400">*</span>
                            </label>
                            <input type="email" placeholder="votre@email.com"
                                value={form.email} onChange={e => set('email', e.target.value)}
                                required className={inputCls} style={{ fontFamily: "'Outfit', sans-serif" }}
                                onFocus={focusGold} onBlur={blurGold} />
                        </div>
                    </div>

                    {/* Téléphone + Budget */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5"
                                style={{ fontFamily: "'Outfit', sans-serif" }}>
                                Téléphone
                            </label>
                            <input type="tel" placeholder="+242 06 000 00 00"
                                value={form.phone} onChange={e => set('phone', e.target.value)}
                                className={inputCls} style={{ fontFamily: "'Outfit', sans-serif" }}
                                onFocus={focusGold} onBlur={blurGold} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5"
                                style={{ fontFamily: "'Outfit', sans-serif" }}>
                                Budget estimé
                            </label>
                            <select value={form.budget} onChange={e => set('budget', e.target.value)}
                                className={inputCls} style={{ fontFamily: "'Outfit', sans-serif" }}
                                onFocus={focusGold} onBlur={blurGold}>
                                {BUDGETS.map(b => <option key={b.v} value={b.v}>{b.l}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5"
                            style={{ fontFamily: "'Outfit', sans-serif" }}>
                            Description du projet <span className="text-red-400">*</span>
                        </label>
                        <textarea rows={4} maxLength={1000} placeholder="Décrivez votre projet de communication..."
                            value={form.description} onChange={e => set('description', e.target.value)}
                            required className={`${inputCls} resize-none`}
                            style={{ fontFamily: "'Outfit', sans-serif" }}
                            onFocus={focusGold} onBlur={blurGold} />
                        <p className="text-right text-xs text-gray-400 mt-1"
                            style={{ fontFamily: "'Outfit', sans-serif" }}>
                            {form.description.length}/1000
                        </p>
                    </div>

                    {/* Submit */}
                    <motion.button type="submit" disabled={loading}
                        whileHover={{ scale: loading ? 1 : 1.02 }} whileTap={{ scale: 0.98 }}
                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-white text-sm transition-all"
                        style={{
                            background:  loading ? '#9CA3AF' : `linear-gradient(135deg, ${GOLD_DARK}, ${GOLD})`,
                            boxShadow:   loading ? 'none' : `0 4px 20px ${GOLD}40`,
                            fontFamily:  "'Outfit', sans-serif",
                        }}>
                        {loading
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Envoi...</>
                            : <><Send className="w-4 h-4" /> Envoyer ma demande</>
                        }
                    </motion.button>
                </form>
            </motion.div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────
// Page principale
// ─────────────────────────────────────────────────────────────
const AltcomPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();

    const [loading,        setLoading]        = useState(true);
    const [portfolio,      setPortfolio]       = useState([]);
    const [reviews,        setReviews]         = useState([]);
    const [reviewsLoading, setReviewsLoading]  = useState(true);
    const [showQuoteModal, setShowModal]        = useState(false);
    const [selectedSvc,    setSelectedSvc]      = useState('');
    const [notif,          setNotif]            = useState({ visible: false, msg: '', ok: true });
    const [currentPage,    setCurrentPage]      = useState(1);
    const [showProject,    setShowProject]      = useState(false);

    const openQuote = (svc) => { setSelectedSvc(svc); setShowModal(true); };

    const showNotif = (msg, ok = true) => {
        setNotif({ visible: true, msg, ok });
        setTimeout(() => setNotif({ visible: false, msg: '', ok: true }), 5000);
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const portfolioData = await getAllPortfolioItems();
                const filtered = portfolioData.filter(
                    item => item.isPublished && (item.pole === 'Altcom' || !item.pole)
                );
                setPortfolio(filtered || []);
            } catch {
                setPortfolio([]);
            } finally {
                setLoading(false);
            }
        };
        const fetchReviews = async () => {
            try {
                const data = await getAltcomReviews(6);
                setReviews(data || []);
            } catch {
                setReviews([]);
            } finally {
                setReviewsLoading(false);
            }
        };
        fetchData();
        fetchReviews();

        if (location.state?.openQuoteModal) {
            openQuote(location.state.service || 'Demande Générale');
            window.history.replaceState({}, document.title);
        }
    }, [location.state]);

    const totalPages     = Math.ceil(portfolio.length / PORTFOLIO_PER_PAGE);
    const currentPortfolio = useMemo(
        () => portfolio.slice((currentPage - 1) * PORTFOLIO_PER_PAGE, currentPage * PORTFOLIO_PER_PAGE),
        [portfolio, currentPage]
    );

    const handleQuoteSubmit = async (formData) => {
        await createQuoteRequest(formData);
        showNotif(`Demande pour "${formData.service}" enregistrée. Réponse sous 24h !`);
    };

    const handleProjectSubmit = async (formData) => {
        try {
            await createAltcomProject(formData);
            showNotif(`Projet "${formData.projectName}" soumis avec succès.`);
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Erreur lors de la soumission.';
            showNotif(msg, false);
            throw err;
        }
    };

    const handleLeaveReview = () =>
        navigate(user ? '/avis/nouveau' : '/login', { state: user ? undefined : { from: '/avis/nouveau' } });

    return (
        <div className="min-h-screen bg-white" style={{ fontFamily: "'Outfit', sans-serif" }}>

            {/* Toast */}
            <AnimatePresence>
                {notif.visible && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                        className="fixed top-20 right-4 z-50 px-5 py-3.5 rounded-2xl shadow-2xl text-white text-sm font-semibold max-w-sm"
                        style={{
                            background:  notif.ok ? 'linear-gradient(135deg, #16a34a, #15803d)' : 'linear-gradient(135deg, #D42B2B, #A01E1E)',
                            fontFamily:  "'Outfit', sans-serif",
                        }}>
                        {notif.msg}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Modals */}
            <AnimatePresence>
                {showQuoteModal && (
                    <QuoteModal serviceTitle={selectedSvc} onClose={() => setShowModal(false)} onSubmit={handleQuoteSubmit} />
                )}
            </AnimatePresence>
            <AnimatePresence>
                {showProject && (
                    <AltcomProjectFormModal onClose={() => setShowProject(false)} onFormSubmit={handleProjectSubmit} />
                )}
            </AnimatePresence>

            {/* ══════════════════════════════════════════
                HERO
            ══════════════════════════════════════════ */}
            <header className="relative text-white overflow-hidden"
                style={{ height: 'calc(100vh - 0px)', minHeight: '640px', maxHeight: '860px' }}>

                {/* Slider */}
                <HeroSliderAltcom />
                <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-black/60 z-[1]" />

                <div className="absolute inset-0 z-10 flex flex-col justify-center px-4 sm:px-8 lg:px-16" style={{ zIndex: 5 }}>
                    <div className="max-w-6xl mx-auto w-full">

                        {/* Badge */}
                        <motion.div
                            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest text-white border border-white/20 backdrop-blur-sm mb-5"
                            style={{ backgroundColor: `${GOLD}25` }}>
                            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: GOLD_LIGHT }} />
                            Altcom — Communication & Créativité
                        </motion.div>

                        {/* Titre */}
                        <motion.h1
                            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.15, duration: 0.7 }}
                            className="text-white mb-4 max-w-3xl"
                            style={{
                                fontFamily: "'Cormorant Garamond', Georgia, serif",
                                fontSize:   'clamp(2.5rem, 5.5vw, 5rem)',
                                fontWeight: 700, lineHeight: 1.1,
                                letterSpacing: '-0.02em',
                            }}>
                            Altcom
                            <span className="block" style={{ color: GOLD_LIGHT }}>
                                Stratégie & Créativité
                            </span>
                        </motion.h1>

                        {/* Ligne déco */}
                        <motion.div
                            initial={{ width: 0 }} animate={{ width: '64px' }}
                            transition={{ delay: 0.4, duration: 0.6 }}
                            className="h-0.5 rounded-full mb-5"
                            style={{ background: `linear-gradient(to right, ${GOLD}, ${BLUE})` }} />

                        {/* Sous-titre */}
                        <motion.p
                            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3, duration: 0.7 }}
                            className="text-white/75 max-w-xl mb-8 leading-relaxed"
                            style={{ fontSize: 'clamp(0.95rem, 1.6vw, 1.15rem)', fontWeight: 300 }}>
                            Votre Vision, Notre Mission. Des solutions de communication percutantes et sur mesure pour propulser votre marque.
                        </motion.p>

                        {/* CTA */}
                        <motion.div
                            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                            className="flex flex-wrap gap-3">
                            <button onClick={() => setShowProject(true)}
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-white text-sm transition-all hover:scale-105"
                                style={{
                                    background: `linear-gradient(135deg, ${GOLD_DARK}, ${GOLD})`,
                                    boxShadow:  `0 4px 20px ${GOLD}50`,
                                    fontFamily: "'Outfit', sans-serif",
                                }}>
                                <Presentation className="w-4 h-4" />
                                Démarrer votre projet
                            </button>
                            <Link to="/altcom/annonces"
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-white text-sm border border-white/20 hover:bg-white/15 backdrop-blur-sm transition-all"
                                style={{ fontFamily: "'Outfit', sans-serif" }}>
                                <Briefcase className="w-4 h-4" />
                                Voir nos réalisations
                            </Link>
                        </motion.div>
                    </div>
                </div>

                {/* Atouts en bas */}
                <div className="absolute bottom-0 left-0 right-0" style={{ zIndex: 5 }}>
                    <div className="h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.1), transparent)' }} />
                    <div className="backdrop-blur-md bg-black/30 grid grid-cols-2 sm:grid-cols-4 divide-x divide-white/10">
                        {ATOUTS.map(({ icon: Icon, label, color }, i) => (
                            <div key={i} className="flex items-center gap-2.5 px-5 py-3.5">
                                <Icon className="w-4 h-4 flex-shrink-0" style={{ color }} />
                                <span className="text-white/70 text-xs font-medium">{label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </header>

            {/* ══════════════════════════════════════════
                À PROPOS — Layout asymétrique
            ══════════════════════════════════════════ */}
            <section className="py-20 sm:py-24 bg-white overflow-hidden">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <div className="lg:grid lg:grid-cols-2 lg:gap-16 lg:items-center">

                        <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }} transition={{ duration: 0.7 }} className="mb-12 lg:mb-0">
                            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: GOLD }}>
                                Notre approche
                            </p>
                            <h2 className="text-gray-900 mb-5"
                                style={{
                                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                                    fontSize:   'clamp(2rem, 4vw, 3.2rem)',
                                    fontWeight: 700, lineHeight: 1.1,
                                }}>
                                Qui Sommes-Nous ?
                            </h2>
                            <div className="h-0.5 w-16 rounded-full mb-6"
                                style={{ background: `linear-gradient(to right, ${GOLD}, ${BLUE})` }} />
                            <p className="text-gray-600 leading-relaxed mb-6 text-base sm:text-lg">
                                Altcom est le pôle de communication d'Altitude-Vision, spécialisé dans la création de{' '}
                                <span className="font-semibold text-gray-900">stratégies percutantes</span>. Nous aidons les marques à raconter leur histoire et à{' '}
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
                                style={{
                                    background: `linear-gradient(135deg, ${GOLD_DARK}, ${GOLD})`,
                                    boxShadow:  `0 4px 20px ${GOLD}30`,
                                    fontFamily: "'Outfit', sans-serif",
                                }}>
                                Démarrer un projet
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </motion.div>

                        {/* Stats */}
                        <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.1 }}
                            className="grid grid-cols-2 gap-4">
                            {[
                                { value: '80+',  label: 'Projets réalisés',    color: GOLD },
                                { value: '98%',  label: 'Clients satisfaits',  color: BLUE },
                                { value: '5 ans',label: "D'expérience",        color: GOLD },
                                { value: '24h',  label: 'Délai de réponse',    color: BLUE },
                            ].map(({ value, label, color }, i) => (
                                <motion.div key={i}
                                    initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }} transition={{ delay: 0.2 + i * 0.1 }}
                                    className="p-6 rounded-2xl border text-center"
                                    style={{ backgroundColor: `${color}08`, borderColor: `${color}20` }}>
                                    <p className="mb-1" style={{
                                        fontFamily: "'Cormorant Garamond', serif",
                                        fontSize: '2.5rem', fontWeight: 700, color, lineHeight: 1,
                                    }}>{value}</p>
                                    <p className="text-xs text-gray-500 font-medium">{label}</p>
                                </motion.div>
                            ))}
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════
                SERVICES
            ══════════════════════════════════════════ */}
            <section className="py-16 sm:py-20 bg-gray-50">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <motion.div className="text-center mb-12"
                        initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }} transition={{ duration: 0.6 }}>
                        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: GOLD }}>
                            Nos Expertises
                        </p>
                        <h2 className="text-gray-900 mb-3"
                            style={{
                                fontFamily: "'Cormorant Garamond', Georgia, serif",
                                fontSize:   'clamp(2rem, 4vw, 3rem)',
                                fontWeight: 700, lineHeight: 1.1,
                            }}>
                            Nos Services
                        </h2>
                        <p className="text-gray-500 text-sm max-w-xl mx-auto">
                            Des solutions sur mesure pour amplifier votre message et engager votre audience
                        </p>
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                        {DEFAULT_SERVICES.map((s, i) => (
                            <ServiceCard key={s._id} service={s} onQuote={openQuote} index={i} />
                        ))}
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════
                PORTFOLIO
            ══════════════════════════════════════════ */}
            <section id="portfolio" className="py-16 sm:py-20 bg-white">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
                        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }} transition={{ duration: 0.6 }}>
                            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: GOLD }}>
                                Portfolio
                            </p>
                            <h2 className="text-gray-900"
                                style={{
                                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                                    fontSize:   'clamp(1.8rem, 3.5vw, 2.8rem)',
                                    fontWeight: 700, lineHeight: 1.1,
                                }}>
                                Nos Réalisations
                            </h2>
                        </motion.div>
                        <Link to="/altcom/annonces"
                            className="inline-flex items-center gap-2 text-sm font-semibold transition-all group flex-shrink-0"
                            style={{ color: GOLD }}>
                            Voir tous les projets
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
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
                                    <motion.div key={item._id}
                                        initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true, amount: 0.1 }}
                                        transition={{ duration: 0.4, delay: i * 0.05 }}>
                                        <PortfolioCard item={item} />
                                    </motion.div>
                                ))}
                            </div>
                            <Pagination totalPages={totalPages} currentPage={currentPage}
                                onPageChange={p => { setCurrentPage(p); document.getElementById('portfolio')?.scrollIntoView({ behavior: 'smooth' }); }} />
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

            {/* ══════════════════════════════════════════
                AVIS CLIENTS
            ══════════════════════════════════════════ */}
            <section className="py-16 sm:py-20 bg-gray-50">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
                        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }} transition={{ duration: 0.6 }}>
                            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: GOLD }}>
                                Témoignages
                            </p>
                            <h2 className="text-gray-900"
                                style={{
                                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                                    fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)',
                                    fontWeight: 700, lineHeight: 1.1,
                                }}>
                                Ils Nous Font Confiance
                            </h2>
                        </motion.div>
                        <motion.button onClick={handleLeaveReview}
                            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-white text-sm flex-shrink-0"
                            style={{
                                background: `linear-gradient(135deg, ${GOLD_DARK}, ${GOLD})`,
                                boxShadow:  `0 4px 16px ${GOLD}30`,
                                fontFamily: "'Outfit', sans-serif",
                            }}>
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
                                <motion.div key={review._id}
                                    initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
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

            {/* ══════════════════════════════════════════
                CTA FINAL
            ══════════════════════════════════════════ */}
            <section className="py-20 relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #0D1117 0%, #1a1505 50%, #0D1117 100%)' }}>
                {/* Halos */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-0 left-1/4 w-80 h-80 rounded-full blur-[120px] opacity-15"
                        style={{ background: GOLD }} />
                    <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full blur-[120px] opacity-8"
                        style={{ background: BLUE }} />
                </div>
                <div className="absolute top-0 left-0 right-0 h-px"
                    style={{ background: `linear-gradient(to right, transparent, ${GOLD}50, transparent)` }} />

                <div className="container mx-auto px-4 sm:px-6 max-w-4xl text-center relative z-10">
                    <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}>
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-6"
                            style={{ background: `linear-gradient(135deg, ${GOLD_DARK}, ${GOLD})` }}>
                            <Zap className="w-7 h-7 text-white" />
                        </div>
                        <p className="text-xs font-bold uppercase tracking-widest mb-4"
                            style={{ color: GOLD_LIGHT }}>
                            Propulsez votre marque
                        </p>
                        <h2 className="text-white mb-5"
                            style={{
                                fontFamily: "'Cormorant Garamond', Georgia, serif",
                                fontSize:   'clamp(2rem, 4vw, 3.5rem)',
                                fontWeight: 700, lineHeight: 1.1,
                            }}>
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
                                style={{
                                    background: `linear-gradient(135deg, ${GOLD_DARK}, ${GOLD})`,
                                    boxShadow:  `0 8px 32px ${GOLD}40`,
                                    fontFamily: "'Outfit', sans-serif",
                                }}>
                                <UserRoundPen className="w-5 h-5" />
                                Contacter l'équipe Altcom
                            </motion.button>
                            <Link to="/altcom/annonces"
                                className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-semibold text-white/80 text-base border border-white/15 hover:bg-white/10 transition-all"
                                style={{ fontFamily: "'Outfit', sans-serif" }}>
                                <Briefcase className="w-5 h-5" />
                                Voir nos projets
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </section>
        </div>
    );
};

export default AltcomPage;