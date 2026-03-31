import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
    ArrowRight, Sparkles, MessageSquarePlus, Star,
    Search, Home, Building2, TrendingUp, Key,
    Handshake, MapPin, ChevronDown, Calculator,
    ShieldCheck, Clock, Award, CheckCircle,
    Mail, X,
} from 'lucide-react';

import HeroSliderAlt   from '../components/HeroSliderAlt';
import AltimmoContact  from '../components/AltimmoContact';
import PropertyCard    from '../components/PropertyCard';
import ReviewCard      from '../components/ReviewCard';
import CtaCommission   from '../components/CtaCommission';
import SEOHead         from '../components/SEOHead';
import EstimationForm  from '../components/EstimationForm';

import { getLatestPropertiesByPole } from '../services/propertyService';
import { getAltimmoReviews }         from '../services/reviewService';
import { useAuth }                   from '../context/AuthContext';

const BLUE      = '#2E7BB5';
const BLUE_DARK = '#1A5A8A';
const GOLD      = '#C8872A';

const SERVICES = [
    { icon: Key,        title: 'Vente de Biens',           desc: 'Nous vous accompagnons à chaque étape pour vendre votre propriété au meilleur prix.', slug: 'vente-de-biens',        color: BLUE,      stat: '+120 ventes'    },
    { icon: Building2,  title: 'Location & Gestion',        desc: "Confiez-nous la gestion de vos biens pour une tranquillité d'esprit optimale.",      slug: 'location-gestion',      color: BLUE_DARK, stat: '+80 biens gérés' },
    { icon: TrendingUp, title: 'Conseil en Investissement', desc: 'Bénéficiez de notre expertise pour des investissements judicieux et performants.',   slug: 'conseil-investissement', color: GOLD,      stat: '+50 projets'    },
];

const TYPES_BIENS  = ['Tous', 'Appartement', 'Maison', 'Villa', 'Terrain', 'Bureau', 'Commerce'];
const TRANSACTIONS = [
    { label: 'Vente',    value: 'vente'    },
    { label: 'Location', value: 'location' },
];
const BUDGETS = [
    { label: 'Tous les budgets', min: '',          max: ''          },
    { label: '< 50M FCFA',       min: '',          max: '50000000'  },
    { label: '50M – 150M FCFA',  min: '50000000',  max: '150000000' },
    { label: '150M – 500M FCFA', min: '150000000', max: '500000000' },
    { label: '> 500M FCFA',      min: '500000000', max: ''          },
];
const ATOUTS = [
    { icon: ShieldCheck, label: 'Transactions sécurisées',   color: BLUE },
    { icon: Clock,       label: 'Réponse sous 24h',          color: GOLD },
    { icon: Award,       label: 'Experts certifiés',         color: BLUE },
    { icon: MapPin,      label: 'Ancrage local Brazzaville', color: GOLD },
];

/* ─── CSS mobile-first centralisé ─── */
const PAGE_CSS = `
  /* ══ VARIABLES ══ */
  .ai-page {
    --blue:      #2E7BB5;
    --blue-dark: #1A5A8A;
    --gold:      #C8872A;
    --px: 20px;
    --py: clamp(56px, 10vw, 96px);
    font-family: 'Outfit', sans-serif;
  }
  @media (min-width: 640px)  { .ai-page { --px: 40px; } }
  @media (min-width: 1024px) { .ai-page { --px: 48px; } }

  .ai-container {
    max-width: 1152px;
    margin: 0 auto;
    padding: 0 var(--px);
  }

  /* ══ EYEBROW ══ */
  .ai-eyebrow {
    font-size: clamp(0.68rem, 2vw, 0.72rem);   /* ↑ mobile lisible */
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    margin-bottom: 14px;
  }

  /* ══ H2 UNIFIÉ ══ */
  .ai-h2 {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: clamp(2.2rem, 6vw, 3.2rem);     /* ↑ mobile : 2.2rem */
    font-weight: 700;
    line-height: 1.08;
    color: #111827;
  }
  .ai-h2--light { color: #fff; }

  /* ══ HERO — bande recherche ══ */
  .ai-hero-actions {
    position: absolute;
    bottom: 72px;
    left: 0; right: 0;
    z-index: 20;
    display: flex;
    justify-content: center;
    padding: 0 16px;
  }
  .ai-hero-actions-inner {
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: center;
  }

  /* Pill recherche */
  .ai-search-pill {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 13px 22px;
    border-radius: 40px;
    color: #fff;
    font-family: 'Outfit', sans-serif;
    font-size: clamp(0.82rem, 2vw, 0.78rem);   /* ↑ mobile */
    font-weight: 500;
    letter-spacing: 0.06em; text-transform: uppercase;
    cursor: pointer;
    transition: all 0.25s ease;
  }

  /* Pills secondaires */
  .ai-hero-pill-sec {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 12px 18px;
    border-radius: 40px;
    background: rgba(255,255,255,0.08);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255,255,255,0.14);
    color: rgba(255,255,255,0.85);
    font-family: 'Outfit', sans-serif;
    font-size: clamp(0.78rem, 2vw, 0.75rem);   /* ↑ mobile */
    font-weight: 400;
    letter-spacing: 0.05em; text-transform: uppercase;
    text-decoration: none; transition: 0.2s;
  }
  /* Sur mobile < 420px : masquer les pills secondaires pour aérer */
  @media (max-width: 420px) {
    .ai-hero-pill-sec { display: none; }
  }

  /* ══ ATOUTS bande ══ */
  .ai-atouts-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);   /* mobile : 2 cols */
  }
  @media (min-width: 640px) {
    .ai-atouts-grid { grid-template-columns: repeat(4, 1fr); }
  }
  .ai-atout-item {
    display: flex; align-items: center; gap: 10px;
    padding: 12px 14px;
    border-right: 1px solid rgba(255,255,255,0.1);
  }
  @media (min-width: 640px) {
    .ai-atout-item { padding: 14px 20px; gap: 10px; }
  }
  .ai-atout-item:nth-child(2) { border-right: none; }
  @media (min-width: 640px) {
    .ai-atout-item:nth-child(2) { border-right: 1px solid rgba(255,255,255,0.1); }
    .ai-atout-item:last-child { border-right: none; }
  }
  .ai-atout-label {
    color: rgba(255,255,255,0.72);
    font-size: clamp(0.72rem, 2vw, 0.75rem);   /* ↑ mobile */
    font-weight: 500;
  }

  /* ══ SEARCH PANEL ══ */
  .ai-search-panel {
    position: absolute;
    bottom: calc(100% + 12px);
    left: 50%;
    transform: translateX(-50%);
    width: min(92vw, 680px);
    background: rgba(10,12,15,0.93);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 20px;
    padding: 20px;
    box-shadow: 0 24px 64px rgba(0,0,0,0.5);
    z-index: 30;
  }
  .ai-panel-label {
    font-size: clamp(0.62rem, 1.5vw, 0.6rem);
    font-weight: 600; letter-spacing: 0.15em;
    text-transform: uppercase; color: rgba(255,255,255,0.4);
    margin-bottom: 6px; display: block;
  }
  .ai-panel-title {
    font-family: 'Outfit', sans-serif;
    font-size: clamp(0.72rem, 2vw, 0.75rem);   /* ↑ mobile */
    font-weight: 600; letter-spacing: 0.15em;
    text-transform: uppercase; color: rgba(255,255,255,0.5);
  }
  .ai-panel-select {
    width: 100%; appearance: none;
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.2);
    color: #fff;
    font-family: 'Outfit', sans-serif;
    font-size: clamp(0.82rem, 2vw, 0.84rem);   /* ↑ mobile */
    border-radius: 12px;
    padding: 12px 36px 12px 14px;
    cursor: pointer;
  }
  .ai-panel-select:focus { outline: none; border-color: rgba(255,255,255,0.4); }

  /* Filtres : 1 col mobile, 3 cols desktop */
  .ai-panel-filters {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
    margin-bottom: 12px;
  }
  @media (min-width: 480px) {
    .ai-panel-filters { grid-template-columns: repeat(3, 1fr); gap: 8px; }
  }

  .ai-panel-search-btn {
    width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 13px; border-radius: 12px;
    font-family: 'Outfit', sans-serif;
    font-size: clamp(0.84rem, 2vw, 0.82rem);   /* ↑ mobile */
    font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;
    color: #fff; cursor: pointer; border: none;
    background: linear-gradient(135deg, ${BLUE}, ${BLUE_DARK});
    box-shadow: 0 4px 20px ${BLUE}50;
  }

  /* ══ SECTION À PROPOS ══ */
  .ai-about-section {
    padding: var(--py) 0;
    background: #fff;
    overflow: hidden;
  }
  .ai-about-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: clamp(40px, 8vw, 64px);
    align-items: center;
  }
  @media (min-width: 1024px) {
    .ai-about-grid { grid-template-columns: 1fr 1fr; }
  }

  .ai-about-h2 {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: clamp(2.2rem, 6vw, 3.2rem);     /* ↑ mobile */
    font-weight: 700; line-height: 1.08; color: #111827;
    margin-bottom: 20px;
  }
  .ai-about-body {
    font-size: clamp(0.95rem, 2.5vw, 1.05rem);  /* ↑ mobile */
    color: #4B5563; line-height: 1.75; margin-bottom: 20px;
  }
  .ai-about-check {
    display: flex; align-items: center; gap: 12px;
    font-size: clamp(0.88rem, 2vw, 0.88rem);    /* ↑ mobile */
    color: #4B5563;
  }

  /* Stats 2x2 mobile */
  .ai-stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 14px;
  }
  .ai-stat-card {
    padding: clamp(20px, 4vw, 28px);
    border-radius: 20px; border: 1px solid; text-align: center;
  }
  .ai-stat-num {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(2.2rem, 7vw, 2.8rem);      /* ↑ mobile */
    font-weight: 700; line-height: 1; margin-bottom: 4px;
  }
  .ai-stat-label {
    font-size: clamp(0.72rem, 2vw, 0.72rem);    /* ↑ mobile */
    color: #6B7280; font-weight: 500;
  }

  /* ══ SERVICES ══ */
  .ai-services-section {
    padding: var(--py) 0;
    background: #F9FAFB;
  }
  .ai-services-grid {
    display: grid;
    grid-template-columns: 1fr;          /* mobile : 1 col */
    gap: 16px;
  }
  @media (min-width: 768px) {
    .ai-services-grid { grid-template-columns: repeat(3, 1fr); }
  }

  .ai-service-card {
    background: #fff; border-radius: 24px;
    padding: clamp(24px, 4vw, 32px);
    border: 1px solid; position: relative;
    overflow: hidden; transition: all 0.4s ease;
  }
  .ai-service-card:hover { transform: translateY(-6px); box-shadow: 0 20px 50px rgba(0,0,0,0.08); }
  .ai-service-card:hover .ai-service-accent { opacity: 1 !important; }
  .ai-service-title {
    font-family: 'Outfit', sans-serif;
    font-size: clamp(1.05rem, 3vw, 1.1rem);     /* ↑ mobile */
    font-weight: 700; color: #111827; margin-bottom: 8px;
  }
  .ai-service-desc {
    font-size: clamp(0.88rem, 2vw, 0.88rem);    /* ↑ mobile */
    color: #6B7280; line-height: 1.7; margin-bottom: 20px;
  }
  .ai-service-cta {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: clamp(0.84rem, 2vw, 0.84rem);    /* ↑ mobile */
    font-weight: 600; transition: gap 0.2s;
  }
  .ai-service-card:hover .ai-service-cta { gap: 10px; }
  /* Sur mobile : lien toujours visible (pas de hover) */
  @media (hover: none) {
    .ai-service-accent { opacity: 1 !important; }
  }

  /* ══ BIENS RÉCENTS ══ */
  .ai-properties-section {
    padding: var(--py) 0;
    background: #fff;
  }
  .ai-properties-head {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-bottom: clamp(32px, 6vw, 48px);
  }
  @media (min-width: 640px) {
    .ai-properties-head {
      flex-direction: row;
      align-items: flex-end;
      justify-content: space-between;
    }
  }
  .ai-properties-h2 {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: clamp(2rem, 5vw, 2.8rem);         /* ↑ mobile */
    font-weight: 700; line-height: 1.1; color: #111827;
  }
  .ai-properties-link {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: clamp(0.84rem, 2vw, 0.84rem);     /* ↑ mobile */
    font-weight: 600; white-space: nowrap; flex-shrink: 0;
  }
  .ai-properties-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
  }
  @media (min-width: 560px) {
    .ai-properties-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (min-width: 1024px) {
    .ai-properties-grid { grid-template-columns: repeat(3, 1fr); }
  }

  /* Skeleton */
  .ai-skeleton-card {
    border-radius: 24px; overflow: hidden;
    border: 1px solid #F3F4F6;
    background: #fff;
    animation: aiSkeleton 2s ease-in-out infinite;
  }
  .ai-skeleton-img { height: 220px; background: #E5E7EB; }
  .ai-skeleton-body { padding: 20px; display: flex; flex-direction: column; gap: 10px; }
  .ai-skeleton-line { height: 13px; border-radius: 6px; background: #F3F4F6; }
  @keyframes aiSkeleton {
    0%,100% { opacity: 1; }
    50%      { opacity: 0.55; }
  }

  /* ══ ESTIMATION ══ */
  .ai-estimation-section {
    padding: var(--py) 0;
    position: relative; overflow: hidden;
    background: linear-gradient(135deg, #0D1117 0%, #0e1e30 60%, #0D1117 100%);
  }
  .ai-estimation-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: clamp(40px, 8vw, 64px);
    align-items: start;
  }
  @media (min-width: 1024px) {
    .ai-estimation-grid { grid-template-columns: 2fr 3fr; }
  }
  .ai-estimation-h2 {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: clamp(2rem, 5vw, 2.8rem);         /* ↑ mobile */
    font-weight: 700; line-height: 1.1; color: #fff;
    margin-bottom: 16px;
  }
  .ai-estimation-body {
    font-size: clamp(0.9rem, 2vw, 0.88rem);      /* ↑ mobile */
    color: rgba(255,255,255,0.6); line-height: 1.75; margin-bottom: 24px;
  }
  .ai-estimation-check {
    display: flex; align-items: center; gap: 10px;
    font-size: clamp(0.86rem, 2vw, 0.86rem);     /* ↑ mobile */
    color: rgba(255,255,255,0.6);
  }

  /* ══ AVIS ══ */
  .ai-reviews-section {
    padding: var(--py) 0;
    background: #F9FAFB;
  }
  .ai-reviews-head {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-bottom: clamp(28px, 5vw, 40px);
  }
  @media (min-width: 640px) {
    .ai-reviews-head {
      flex-direction: row;
      align-items: flex-end;
      justify-content: space-between;
    }
  }
  .ai-reviews-h2 {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: clamp(2rem, 5vw, 2.8rem);         /* ↑ mobile */
    font-weight: 700; line-height: 1.1; color: #111827;
  }
  .ai-review-btn {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 12px 20px;
    border-radius: 40px; font-weight: 600; color: #fff;
    font-size: clamp(0.82rem, 2vw, 0.84rem);     /* ↑ mobile */
    flex-shrink: 0; white-space: nowrap;
    font-family: 'Outfit', sans-serif;
    border: none; cursor: pointer;
  }
  .ai-reviews-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 14px;
  }
  @media (min-width: 640px) {
    .ai-reviews-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (min-width: 1024px) {
    .ai-reviews-grid { grid-template-columns: repeat(3, 1fr); }
  }

  /* ══ BTN PRIMARY ══ */
  .ai-btn-primary {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 14px 26px; border-radius: 40px;
    font-family: 'Outfit', sans-serif;
    font-size: clamp(0.84rem, 2vw, 0.84rem);     /* ↑ mobile */
    font-weight: 600; color: #fff;
    text-decoration: none; transition: all 0.25s;
    letter-spacing: 0.02em;
  }
  .ai-btn-primary:hover { transform: translateY(-2px); }
`;

/* ─── Composants ─── */
const FadeIn = ({ children, delay = 0, x = 0, y = 24 }) => (
    <motion.div
        initial={{ opacity: 0, x, y }}
        whileInView={{ opacity: 1, x: 0, y: 0 }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{ duration: 0.7, delay, ease: [0.25, 0.46, 0.45, 0.94] }}>
        {children}
    </motion.div>
);

const PropertySkeleton = () => (
    <div className="ai-skeleton-card">
        <div className="ai-skeleton-img" />
        <div className="ai-skeleton-body">
            <div className="ai-skeleton-line" style={{ width: '70%' }} />
            <div className="ai-skeleton-line" style={{ width: '100%' }} />
            <div className="ai-skeleton-line" style={{ width: '45%', marginTop: '6px' }} />
        </div>
    </div>
);

/* ─── Panneau recherche ─── */
const SearchPanel = ({ onClose, onSearch }) => {
    const [typeBien,    setTypeBien]    = useState('Tous');
    const [transaction, setTransaction] = useState('vente');
    const [budgetIdx,   setBudgetIdx]   = useState(0);

    const handleSubmit = () => { onSearch({ typeBien, transaction, budgetIdx }); onClose(); };

    return (
        <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="ai-search-panel">

            {/* En-tête */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span className="ai-panel-title">Rechercher un bien</span>
                <button onClick={onClose} style={{
                    padding: '6px', borderRadius: '8px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center',
                }}>
                    <X size={14} />
                </button>
            </div>

            {/* Filtres */}
            <div className="ai-panel-filters">
                {[
                    { label: 'Transaction', value: transaction, setter: setTransaction, options: TRANSACTIONS.map(t => ({ v: t.value, l: t.label })) },
                    { label: 'Type de bien', value: typeBien,    setter: setTypeBien,    options: TYPES_BIENS.map(t => ({ v: t, l: t })) },
                    { label: 'Budget',       value: budgetIdx,   setter: (v) => setBudgetIdx(Number(v)), options: BUDGETS.map((b, i) => ({ v: i, l: b.label })) },
                ].map(({ label, value, setter, options }) => (
                    <div key={label} style={{ position: 'relative' }}>
                        <label className="ai-panel-label">{label}</label>
                        <div style={{ position: 'relative' }}>
                            <select value={value} onChange={e => setter(e.target.value)}
                                className="ai-panel-select">
                                {options.map(o => (
                                    <option key={o.v} value={o.v} className="text-gray-900">{o.l}</option>
                                ))}
                            </select>
                            <ChevronDown style={{
                                position: 'absolute', right: '10px', top: '50%',
                                transform: 'translateY(-50%)',
                                width: '14px', height: '14px',
                                color: 'rgba(255,255,255,0.35)', pointerEvents: 'none',
                            }} />
                        </div>
                    </div>
                ))}
            </div>

            <button onClick={handleSubmit} className="ai-panel-search-btn">
                <Search size={15} aria-hidden="true" />
                Rechercher
            </button>
        </motion.div>
    );
};

/* ─────────────────────────────────────────────────────────────
   PAGE PRINCIPALE
───────────────────────────────────────────────────────────── */
const AltimmoPage = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    const [properties,     setProperties]    = useState([]);
    const [reviews,        setReviews]        = useState([]);
    const [loading,        setLoading]        = useState(true);
    const [reviewsLoading, setReviewsLoading] = useState(true);
    const [searchOpen,     setSearchOpen]     = useState(false);

    const handleSearch = ({ typeBien, transaction, budgetIdx }) => {
        const params = new URLSearchParams();
        params.set('status', transaction);
        if (typeBien !== 'Tous') params.set('type', typeBien);
        const budget = BUDGETS[budgetIdx];
        if (budget.min) params.set('priceMin', budget.min);
        if (budget.max) params.set('priceMax', budget.max);
        navigate(`/altimmo/annonces?${params.toString()}`);
    };

    const handleScrollToContact = (e) => {
        e.preventDefault();
        document.getElementById('contact-altimmo')?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleLeaveReview = () =>
        navigate(user ? '/avis/nouveau' : '/login', {
            state: user ? undefined : { from: '/avis/nouveau' },
        });

    useEffect(() => {
        const fetchProperties = async () => {
            try { setProperties((await getLatestPropertiesByPole('Altimmo', 6)) || []); }
            catch { /* ignore */ }
            finally { setLoading(false); }
        };
        const fetchReviews = async () => {
            try { setReviews((await getAltimmoReviews(6)) || []); }
            catch { setReviews([]); }
            finally { setReviewsLoading(false); }
        };
        fetchProperties();
        fetchReviews();
    }, []);

    return (
        <div className="ai-page" style={{ minHeight: '100vh', background: '#fff' }}>
            <style>{PAGE_CSS}</style>

            <SEOHead
                title="Altimmo — Achat, Vente & Location Immobilière à Brazzaville"
                description="Altimmo by Altitude-Vision : trouvez des appartements, maisons et villas à vendre ou à louer à Brazzaville, Congo."
                url="/altimmo"
                image="/og-altimmo.jpg"
                breadcrumb={[
                    { name: 'Accueil', path: '/' },
                    { name: 'Altimmo', path: '/altimmo' },
                ]}
            />

            {/* ══ HERO ════════════════════════════════════════════════ */}
            <header style={{
                position: 'relative', color: '#fff', overflow: 'hidden',
                height: 'calc(100vh - 0px)', minHeight: '640px', maxHeight: '860px',
            }}>
                <HeroSliderAlt />

                {/* Raccourci recherche */}
                <div className="ai-hero-actions">
                    <div className="ai-hero-actions-inner">

                        <AnimatePresence>
                            {searchOpen && (
                                <SearchPanel
                                    onClose={() => setSearchOpen(false)}
                                    onSearch={handleSearch}
                                />
                            )}
                        </AnimatePresence>

                        <motion.button
                            onClick={() => setSearchOpen(!searchOpen)}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5, duration: 0.5 }}
                            className="ai-search-pill"
                            style={{
                                background: searchOpen
                                    ? `linear-gradient(135deg, ${BLUE}, ${BLUE_DARK})`
                                    : 'rgba(10,12,15,0.55)',
                                backdropFilter: 'blur(16px)',
                                WebkitBackdropFilter: 'blur(16px)',
                                border: searchOpen
                                    ? `1px solid ${BLUE}60`
                                    : '1px solid rgba(255,255,255,0.18)',
                                boxShadow: searchOpen
                                    ? `0 6px 24px ${BLUE}45`
                                    : '0 4px 20px rgba(0,0,0,0.3)',
                            }}
                            aria-label="Rechercher un bien immobilier"
                            aria-expanded={searchOpen}>
                            <Search size={16} aria-hidden="true" />
                            Rechercher un bien
                            <ChevronDown size={13} style={{
                                opacity: 0.6,
                                transform: searchOpen ? 'rotate(180deg)' : 'rotate(0)',
                                transition: 'transform 0.25s',
                            }} />
                        </motion.button>

                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.62, duration: 0.5 }}
                            style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                            <Link to="/altimmo/annonces" className="ai-hero-pill-sec">
                                <Sparkles size={13} aria-hidden="true" />
                                Toutes les annonces
                            </Link>
                            <a href="#contact-altimmo" onClick={handleScrollToContact} className="ai-hero-pill-sec">
                                <Handshake size={13} aria-hidden="true" />
                                Nous contacter
                            </a>
                        </motion.div>
                    </div>
                </div>

                {/* Bande atouts */}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10 }}>
                    <div style={{ height: '1px', background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.08), transparent)' }} />
                    <div className="ai-atouts-grid" style={{ backdropFilter: 'blur(12px)', background: 'rgba(0,0,0,0.32)' }}>
                        {ATOUTS.map(({ icon: Icon, label, color }, i) => (
                            <div key={i} className="ai-atout-item">
                                <Icon size={15} style={{ color, flexShrink: 0 }} aria-hidden="true" />
                                <span className="ai-atout-label">{label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </header>

            {/* ══ À PROPOS ════════════════════════════════════════════ */}
            <section className="ai-about-section">
                <div className="ai-container">
                    <div className="ai-about-grid">

                        {/* Texte */}
                        <FadeIn x={-28}>
                            <p className="ai-eyebrow" style={{ color: BLUE }}>Notre approche</p>
                            <h2 className="ai-about-h2">
                                L'Excellence au Service<br />de Vos Projets
                            </h2>
                            <div style={{
                                height: '2px', width: '56px', borderRadius: '2px', marginBottom: '24px',
                                background: `linear-gradient(to right, ${BLUE}, ${GOLD})`,
                            }} />
                            <p className="ai-about-body">
                                Forts d'une connaissance approfondie du marché immobilier de Brazzaville, nous offrons une approche personnalisée, alliant{' '}
                                <strong style={{ color: '#111827' }}>innovation</strong>,{' '}
                                <strong style={{ color: '#111827' }}>expertise légale</strong> et{' '}
                                <strong style={{ color: '#111827' }}>écoute attentive</strong>.
                            </p>
                            <ul style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
                                {[
                                    'Estimation gratuite et sans engagement',
                                    'Accompagnement juridique inclus',
                                    "Réseau d'acquéreurs qualifiés",
                                    'Transparence totale sur les frais',
                                ].map((item, i) => (
                                    <li key={i} className="ai-about-check">
                                        <CheckCircle size={16} style={{ color: BLUE, flexShrink: 0 }} />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                            <Link to="/altimmo/annonces" className="ai-btn-primary"
                                style={{ background: `linear-gradient(135deg, ${BLUE}, ${BLUE_DARK})`, boxShadow: `0 4px 20px ${BLUE}30` }}>
                                Découvrir nos biens <ArrowRight size={16} />
                            </Link>
                        </FadeIn>

                        {/* Stats 2×2 */}
                        <FadeIn x={28} delay={0.1}>
                            <div className="ai-stats-grid">
                                {[
                                    { value: '200+', label: 'Biens vendus',       color: BLUE      },
                                    { value: '98%',  label: 'Clients satisfaits', color: GOLD      },
                                    { value: '5 ans',label: "D'expérience",       color: BLUE_DARK },
                                    { value: '24h',  label: 'Délai de réponse',   color: BLUE      },
                                ].map(({ value, label, color }, i) => (
                                    <FadeIn key={i} delay={0.15 + i * 0.08} y={16}>
                                        <div className="ai-stat-card"
                                            style={{ backgroundColor: `${color}08`, borderColor: `${color}20` }}>
                                            <p className="ai-stat-num" style={{ color }}>{value}</p>
                                            <p className="ai-stat-label">{label}</p>
                                        </div>
                                    </FadeIn>
                                ))}
                            </div>
                        </FadeIn>

                    </div>
                </div>
            </section>

            {/* ══ SERVICES ════════════════════════════════════════════ */}
            <section className="ai-services-section">
                <div className="ai-container">
                    <FadeIn>
                        <div style={{ textAlign: 'center', marginBottom: 'clamp(36px, 6vw, 48px)' }}>
                            <p className="ai-eyebrow" style={{ color: BLUE, justifyContent: 'center' }}>Nos Engagements</p>
                            <h2 className="ai-h2">Une Expertise à Votre Mesure</h2>
                        </div>
                    </FadeIn>

                    <div className="ai-services-grid">
                        {SERVICES.map((service, i) => {
                            const Icon = service.icon;
                            return (
                                <FadeIn key={i} delay={i * 0.1} y={30}>
                                    <div className="ai-service-card" style={{ borderColor: `${service.color}20` }}>
                                        <div className="ai-service-accent" style={{
                                            position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
                                            background: service.color, opacity: 0, transition: '0.3s',
                                        }} />
                                        <div style={{
                                            width: '48px', height: '48px', borderRadius: '14px',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            marginBottom: '20px',
                                            background: `${service.color}15`,
                                            border: `1px solid ${service.color}25`,
                                            transition: 'transform 0.3s',
                                        }}>
                                            <Icon size={22} style={{ color: service.color }} />
                                        </div>
                                        <span style={{
                                            display: 'inline-block', fontSize: '0.72rem', fontWeight: 700,
                                            padding: '4px 10px', borderRadius: '40px', marginBottom: '12px',
                                            background: `${service.color}12`, color: service.color,
                                        }}>
                                            {service.stat}
                                        </span>
                                        <h3 className="ai-service-title">{service.title}</h3>
                                        <p className="ai-service-desc">{service.desc}</p>
                                        <Link to={`/altimmo/services/${service.slug}`}
                                            className="ai-service-cta" style={{ color: service.color }}>
                                            En savoir plus <ArrowRight size={15} />
                                        </Link>
                                    </div>
                                </FadeIn>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* ══ BIENS RÉCENTS ═══════════════════════════════════════ */}
            <section className="ai-properties-section">
                <div className="ai-container">
                    <div className="ai-properties-head">
                        <FadeIn>
                            <p className="ai-eyebrow" style={{ color: BLUE }}>Notre Sélection</p>
                            <h2 className="ai-properties-h2">Biens Immobiliers Récents</h2>
                        </FadeIn>
                        <Link to="/altimmo/annonces" className="ai-properties-link" style={{ color: BLUE }}>
                            Voir toutes les annonces <ArrowRight size={15} />
                        </Link>
                    </div>

                    {loading ? (
                        <div className="ai-properties-grid">
                            {[1, 2, 3].map(i => <PropertySkeleton key={i} />)}
                        </div>
                    ) : properties.length === 0 ? (
                        <div style={{
                            textAlign: 'center', padding: 'clamp(40px,8vw,80px) 24px',
                            borderRadius: '24px', border: `1px dashed ${BLUE}30`,
                            background: `${BLUE}04`,
                        }}>
                            <div style={{
                                width: '56px', height: '56px', borderRadius: '16px',
                                background: `linear-gradient(135deg, ${BLUE}, ${BLUE_DARK})`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                margin: '0 auto 16px',
                            }}>
                                <Home size={26} color="#fff" />
                            </div>
                            <p style={{ fontWeight: 700, color: '#374151', marginBottom: '6px', fontSize: 'clamp(0.95rem,2vw,1rem)' }}>
                                Aucune annonce disponible
                            </p>
                            <p style={{ fontSize: 'clamp(0.85rem,2vw,0.88rem)', color: '#6B7280' }}>
                                Les nouvelles annonces seront bientôt disponibles
                            </p>
                        </div>
                    ) : (
                        <div className="ai-properties-grid">
                            {properties.map((property, index) => (
                                <FadeIn key={property._id} delay={index * 0.05} y={20}>
                                    <PropertyCard property={property} />
                                </FadeIn>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* ══ ESTIMATION ══════════════════════════════════════════ */}
            <section className="ai-estimation-section">
                {/* Halos décoratifs */}
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                    <div style={{ position: 'absolute', top: 0, left: '25%', width: '320px', height: '320px', borderRadius: '50%', filter: 'blur(120px)', opacity: 0.1, background: BLUE }} />
                    <div style={{ position: 'absolute', bottom: 0, right: '25%', width: '320px', height: '320px', borderRadius: '50%', filter: 'blur(120px)', opacity: 0.08, background: GOLD }} />
                </div>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: `linear-gradient(to right, transparent, ${BLUE}40, transparent)` }} />

                <div className="ai-container" style={{ position: 'relative', zIndex: 10 }}>
                    <div className="ai-estimation-grid">

                        {/* Gauche */}
                        <FadeIn x={-28}>
                            <div style={{
                                width: '48px', height: '48px', borderRadius: '14px',
                                background: `linear-gradient(135deg, ${GOLD}, #E5A84B)`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                marginBottom: '20px',
                            }}>
                                <Calculator size={22} color="#fff" />
                            </div>
                            <p className="ai-eyebrow" style={{ color: GOLD }}>Estimation gratuite</p>
                            <h2 className="ai-estimation-h2">
                                Quelle est la valeur<br />de votre bien ?
                            </h2>
                            <div style={{ height: '2px', width: '40px', borderRadius: '2px', marginBottom: '20px', background: `linear-gradient(to right, ${GOLD}, ${BLUE})` }} />
                            <p className="ai-estimation-body">
                                Remplissez le formulaire ci-contre. Notre équipe analyse votre dossier et vous contacte sous{' '}
                                <strong style={{ color: 'rgba(255,255,255,0.85)' }}>24h</strong> avec une estimation personnalisée et sans engagement.
                            </p>
                            <ul style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {[
                                    { icon: CheckCircle, text: '100% gratuit, sans engagement'      },
                                    { icon: Clock,       text: 'Réponse garantie sous 24h'          },
                                    { icon: ShieldCheck, text: 'Expertise marché local Brazzaville' },
                                    { icon: Mail,        text: 'Confirmation par email immédiate'   },
                                ].map(({ icon: Icon, text }, i) => (
                                    <li key={i} className="ai-estimation-check">
                                        <Icon size={15} style={{ color: GOLD, flexShrink: 0 }} />
                                        {text}
                                    </li>
                                ))}
                            </ul>
                        </FadeIn>

                        {/* Droite : formulaire */}
                        <FadeIn x={28} delay={0.1}>
                            <EstimationForm />
                        </FadeIn>

                    </div>
                </div>
            </section>

            {/* ══ AVIS ════════════════════════════════════════════════ */}
            <section className="ai-reviews-section">
                <div className="ai-container">
                    <div className="ai-reviews-head">
                        <FadeIn>
                            <p className="ai-eyebrow" style={{ color: BLUE }}>Témoignages</p>
                            <h2 className="ai-reviews-h2">Ils Nous Font Confiance</h2>
                        </FadeIn>
                        <motion.button onClick={handleLeaveReview}
                            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                            className="ai-review-btn"
                            style={{ background: `linear-gradient(135deg, ${BLUE}, ${BLUE_DARK})`, boxShadow: `0 4px 16px ${BLUE}30` }}>
                            <MessageSquarePlus size={16} />
                            Laisser un avis
                            {!user && <span style={{ opacity: 0.5, fontSize: '0.72rem', fontWeight: 400 }}>(connexion)</span>}
                        </motion.button>
                    </div>

                    {reviewsLoading ? (
                        <div className="ai-reviews-grid">
                            {[1, 2, 3].map(i => (
                                <div key={i} style={{ background: '#fff', borderRadius: '24px', padding: '24px', border: '1px solid #F3F4F6', animation: 'aiSkeleton 2s ease-in-out infinite' }}>
                                    <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                                        <div style={{ width: '40px', height: '40px', background: '#E5E7EB', borderRadius: '50%', flexShrink: 0 }} />
                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <div style={{ height: '12px', background: '#E5E7EB', borderRadius: '6px', width: '60%' }} />
                                            <div style={{ height: '10px', background: '#F3F4F6', borderRadius: '5px', width: '35%' }} />
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <div style={{ height: '12px', background: '#F3F4F6', borderRadius: '6px' }} />
                                        <div style={{ height: '12px', background: '#F3F4F6', borderRadius: '6px', width: '80%' }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : reviews.length > 0 ? (
                        <div className="ai-reviews-grid">
                            {reviews.map((review, index) => (
                                <FadeIn key={review._id} delay={index * 0.07} y={20}>
                                    <ReviewCard review={review} />
                                </FadeIn>
                            ))}
                        </div>
                    ) : (
                        <div style={{
                            textAlign: 'center', padding: 'clamp(40px,8vw,64px) 24px',
                            borderRadius: '24px', border: `1px dashed ${BLUE}25`,
                            background: `${BLUE}03`,
                        }}>
                            <Star size={28} style={{ color: '#D1D5DB', margin: '0 auto 12px', display: 'block' }} />
                            <p style={{ fontWeight: 700, color: '#374151', marginBottom: '6px', fontSize: 'clamp(0.95rem,2vw,1rem)' }}>
                                Aucun avis pour le moment
                            </p>
                            <p style={{ fontSize: 'clamp(0.85rem,2vw,0.88rem)', color: '#6B7280' }}>
                                Soyez le premier à partager votre expérience !
                            </p>
                        </div>
                    )}
                </div>
            </section>

            {/* ══ CTA COMMISSION ══════════════════════════════════════ */}
            <section style={{ padding: 'clamp(40px,8vw,56px) 0', background: '#fff' }}>
                <div className="ai-container"><CtaCommission /></div>
            </section>

            {/* ══ CONTACT ═════════════════════════════════════════════ */}
            <AltimmoContact />

        </div>
    );
};

export default AltimmoPage;