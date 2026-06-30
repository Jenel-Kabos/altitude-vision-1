"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowRight, Sparkles, MessageSquarePlus, Star,
    Search, Home, Building2, TrendingUp, Key,
    Handshake, MapPin, ChevronDown, Calculator,
    ShieldCheck, Clock, Award, CheckCircle,
    Mail, X,
} from 'lucide-react';

import HeroSliderAlt   from '../components/HeroSliderAlt';
import PropertyCard    from '../components/PropertyCard';
import ReviewCard      from '../components/ReviewCard';
import CtaCommission   from '../components/CtaCommission';
import EstimationForm  from '../components/EstimationForm';
import AltimmoContact  from '../components/AltimmoContact';

import { getLatestPropertiesByPole } from '../services/propertyService';
import { getAltimmoReviews }         from '../services/reviewService';
import { useAuth }                   from '../context/AuthContext';
import { PROPERTY_TYPES_WITH_ALL }   from '../constants/propertyTypes';

const BLUE      = '#2E7BB5';
const BLUE_DARK = '#1A5A8A';
const GOLD      = '#C8960C';

const SERVICES = [
    { icon: Key,        title: 'Vente de Biens',           desc: 'Nous vous accompagnons à chaque étape pour vendre votre propriété au meilleur prix.', slug: 'vente-de-biens',        color: BLUE,      stat: '+120 ventes'    },
    { icon: Building2,  title: 'Location & Gestion',        desc: "Confiez-nous la gestion de vos biens pour une tranquillité d'esprit optimale.",      slug: 'location-gestion',      color: BLUE_DARK, stat: '+80 biens gérés' },
    { icon: TrendingUp, title: 'Conseil en Investissement', desc: 'Bénéficiez de notre expertise pour des investissements judicieux et performants.',   slug: 'conseil-investissement', color: GOLD,      stat: '+50 projets'    },
];

const TYPES_BIENS  = PROPERTY_TYPES_WITH_ALL;
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

/* ─────────────────────────────────────────────────────────────
   CSS — corrections d'après screenshot :

   PROBLÈMES VISIBLES :
   1. Bouton "RECHERCHER UN BIEN" → trop grand (pill énorme)
   2. "TOUTES LES ANNONCES" + "NOUS CONTACTER" → pills pleine largeur = énormes
   3. Atouts trop espacés, texte trop grand
   4. Tout déborde en bas du hero

   SOLUTION :
   - Zone actions : hauteur fixe et compacte (~80px)
   - Pill recherche : taille réduite, typographie harmonisée
   - Pills secondaires : texte uniquement sur mobile, icône + texte court
   - Atouts : grille 2×2 mobile compacte avec petits paddings
───────────────────────────────────────────────────────────── */
const PAGE_CSS = `
  .ai-page {
    --blue: #2E7BB5; --blue-dark: #1A5A8A; --gold: #C8960C;
    --px: 20px; --py: clamp(52px, 9vw, 140px);
    font-family: 'DM Sans', sans-serif;
  }
  @media (min-width: 640px)  { .ai-page { --px: 36px; } }
  @media (min-width: 1024px) { .ai-page { --px: 48px; } }
  @media (min-width: 1440px) { .ai-page { --px: 80px; --py: 140px; } }
  @media (min-width: 1920px) { .ai-page { --px: 120px; --py: 160px; } }

  .ai-container { max-width: 1400px; margin: 0 auto; padding: 0 var(--px); }

  /* ══ EYEBROW ══ */
  .ai-eyebrow {
    font-size: 0.64rem; font-weight: 700;
    letter-spacing: 0.18em; text-transform: uppercase; margin-bottom: 12px;
    display: flex; align-items: center;
  }

  /* ══ H2 ══ */
  .ai-h2 {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: clamp(2rem, 5.5vw, 4.5rem);
    font-weight: 300; line-height: 1.08; color: #111827;
  }
  .ai-h2--light { color: #fff; }

  /* ══════════════════════════════════════════════════════════
     HERO ACTIONS ZONE

     Calcul des hauteurs bande atouts :
     - Mobile (< 640px)  : 2 lignes × ~48px = ~96px
     - Desktop (≥ 640px) : 1 ligne  × ~44px = ~44px

     On ajoute 12px d'espacement au-dessus de la bande.
  ══════════════════════════════════════════════════════════ */
  .ai-hero-actions {
    position: absolute;
    /* Mobile : au-dessus des 2 rangées d'atouts (96px) + 12px gap */
    bottom: 108px;
    left: 0; right: 0; z-index: 20;
    display: flex; flex-direction: column;
    align-items: center; gap: 8px;
    padding: 0 16px;
  }
  @media (min-width: 640px) {
    /* Desktop : 1 seule rangée d'atouts (~44px) + 12px gap */
    .ai-hero-actions { bottom: 56px; }
  }

  /* Pill recherche — compact, élégant */
  .ai-search-pill {
    display: inline-flex; align-items: center; gap: 7px;
    /* Compact : moins de padding que l'original */
    padding: 8px 16px;
    border-radius: 5px; /* Carré = pro */
    color: #fff; font-family: 'DM Sans', sans-serif;
    font-size: 0.70rem; font-weight: 600;
    letter-spacing: 0.10em; text-transform: uppercase;
    cursor: pointer; transition: all 0.22s ease;
    white-space: nowrap;
  }

  /* Liens secondaires — texte léger, pas des boutons pleins */
  .ai-hero-links {
    display: flex; align-items: center; gap: 20px;
  }
  .ai-hero-link {
    display: inline-flex; align-items: center; gap: 5px;
    color: rgba(255,255,255,0.55);
    font-family: 'DM Sans', sans-serif;
    font-size: 0.62rem; font-weight: 400;
    letter-spacing: 0.08em; text-transform: uppercase;
    text-decoration: none; transition: color 0.2s;
    white-space: nowrap;
  }
  .ai-hero-link:hover { color: rgba(255,255,255,0.85); }
  /* Séparateur entre les 2 liens */
  .ai-hero-link-sep {
    width: 1px; height: 12px; background: rgba(255,255,255,0.15); flex-shrink: 0;
  }

  /* ══ SEARCH PANEL ══ */
  /* .ai-search-panel : styles inline via portal fixed — voir composant SearchPanel */
  .ai-panel-label {
    display: block; font-size: 0.56rem; font-weight: 600;
    letter-spacing: 0.15em; text-transform: uppercase;
    color: rgba(255,255,255,0.35); margin-bottom: 5px;
  }
  .ai-panel-select {
    width: 100%; appearance: none;
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.14);
    color: #fff; font-family: 'DM Sans', sans-serif;
    font-size: 0.78rem; border-radius: 8px;
    padding: 9px 32px 9px 11px; cursor: pointer;
  }
  .ai-panel-select:focus { outline: none; border-color: rgba(255,255,255,0.32); }
  .ai-panel-filters {
    display: grid; grid-template-columns: 1fr;
    gap: 8px; margin-bottom: 10px;
  }
  @media (min-width: 440px) { .ai-panel-filters { grid-template-columns: repeat(3, 1fr); } }
  .ai-panel-search-btn {
    width: 100%; display: flex; align-items: center; justify-content: center; gap: 7px;
    padding: 10px; border-radius: 8px; font-family: 'DM Sans', sans-serif;
    font-size: 0.72rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
    color: #fff; cursor: pointer; border: none;
    background: linear-gradient(135deg, ${BLUE}, ${BLUE_DARK});
    box-shadow: 0 3px 16px ${BLUE}45;
  }

  /* ══ ATOUTS ══ */
  .ai-atouts-grid {
    display: grid; grid-template-columns: repeat(2, 1fr);
  }
  @media (min-width: 640px) { .ai-atouts-grid { grid-template-columns: repeat(4, 1fr); } }

  .ai-atout-item {
    display: flex; align-items: center; gap: 8px;
    /* Compact : hauteur totale ~48px */
    padding: 10px 12px;
    border-right: 1px solid rgba(255,255,255,0.08);
  }
  .ai-atout-item:nth-child(2n) { border-right: none; }
  @media (min-width: 640px) {
    .ai-atout-item { padding: 12px 16px; }
    .ai-atout-item:nth-child(2) { border-right: 1px solid rgba(255,255,255,0.08); }
    .ai-atout-item:last-child { border-right: none; }
  }
  .ai-atout-label {
    color: rgba(255,255,255,0.65); font-size: 0.68rem; font-weight: 400;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  /* ══ À PROPOS ══ */
  .ai-about-section { padding: var(--py) 0; background: #F8F8F8; overflow: hidden; }
  .ai-about-grid {
    display: grid; grid-template-columns: 1fr;
    gap: clamp(36px, 7vw, 64px); align-items: center;
  }
  @media (min-width: 1024px) { .ai-about-grid { grid-template-columns: 1fr 1fr; } }

  .ai-about-h2 {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: clamp(2rem, 5.5vw, 4.5rem);
    font-weight: 300; line-height: 1.08; color: #111827; margin-bottom: 18px;
  }
  .ai-about-body {
    font-size: clamp(0.90rem, 2vw, 1rem); color: #6B7280; line-height: 1.75; margin-bottom: 18px;
  }
  .ai-about-check {
    display: flex; align-items: center; gap: 10px;
    font-size: clamp(0.84rem, 2vw, 0.86rem); color: #374151;
  }

  .ai-stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .ai-stat-card {
    padding: clamp(18px, 3.5vw, 26px); border-radius: 10px;
    border: 1px solid rgba(17,24,39,0.08); text-align: center;
    background: #FFFFFF; box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  }
  .ai-stat-num {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(2rem, 6vw, 4.5rem);
    font-weight: 300; line-height: 1; margin-bottom: 4px;
  }
  .ai-stat-label { font-size: 0.68rem; color: #6B7280; font-weight: 400; letter-spacing: 0.08em; text-transform: uppercase; }

  /* ══ SERVICES ══ */
  .ai-services-section { padding: var(--py) 0; background: #F8F8F8; }
  .ai-services-grid {
    display: grid; grid-template-columns: 1fr; gap: 14px;
  }
  @media (min-width: 768px) { .ai-services-grid { grid-template-columns: repeat(3, 1fr); } }

  .ai-service-card {
    background: #FFFFFF; border-radius: 10px;
    padding: clamp(22px, 4vw, 30px);
    border: 1px solid rgba(17,24,39,0.08); position: relative; overflow: hidden; transition: all 0.4s ease;
    box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  }
  .ai-service-card:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.10); border-color: rgba(200,150,12,0.2); }
  .ai-service-card:hover .ai-service-accent { opacity: 1 !important; }
  .ai-service-card:hover .ai-service-cta { gap: 10px; }
  @media (hover: none) {
    .ai-service-accent { opacity: 1 !important; }
  }
  .ai-service-title {
    font-size: clamp(0.98rem, 2.5vw, 1.05rem); font-weight: 500; color: #111827; margin-bottom: 7px;
  }
  .ai-service-desc {
    font-size: clamp(0.83rem, 1.8vw, 0.85rem); color: #6B7280; line-height: 1.7; margin-bottom: 18px;
  }
  .ai-service-cta {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 0.72rem; font-weight: 500; transition: gap 0.2s;
  }

  /* ══ BIENS ══ */
  .ai-properties-section { padding: var(--py) 0; background: #F8F8F8; }
  .ai-properties-head {
    display: flex; flex-direction: column; gap: 14px;
    margin-bottom: clamp(28px, 5vw, 44px);
  }
  @media (min-width: 640px) {
    .ai-properties-head { flex-direction: row; align-items: flex-end; justify-content: space-between; }
  }
  .ai-properties-h2 {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: clamp(1.85rem, 4.5vw, 4.5rem);
    font-weight: 300; line-height: 1.1; color: #111827;
  }
  .ai-properties-link {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 0.78rem; font-weight: 500; white-space: nowrap; flex-shrink: 0;
  }
  .ai-properties-grid {
    display: grid; grid-template-columns: 1fr; gap: 14px;
  }
  @media (min-width: 560px) { .ai-properties-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (min-width: 1024px) { .ai-properties-grid { grid-template-columns: repeat(3, 1fr); } }

  .ai-skeleton-card { border-radius: 10px; overflow: hidden; border: 1px solid rgba(17,24,39,0.06); background: #FFFFFF; animation: aiSkeleton 2s ease-in-out infinite; }
  .ai-skeleton-img  { height: 210px; background: #E5E7EB; }
  .ai-skeleton-body { padding: 18px; display: flex; flex-direction: column; gap: 9px; }
  .ai-skeleton-line { height: 12px; border-radius: 5px; background: #E5E7EB; }
  @keyframes aiSkeleton { 0%,100%{opacity:1} 50%{opacity:.4} }

  /* ══ ESTIMATION ══ */
  .ai-estimation-section {
    padding: var(--py) 0; position: relative; overflow: hidden;
    background: #F8F8F8;
  }
  .ai-estimation-grid {
    display: grid; grid-template-columns: 1fr;
    gap: clamp(36px, 7vw, 60px); align-items: start;
  }
  @media (min-width: 1024px) { .ai-estimation-grid { grid-template-columns: 2fr 3fr; } }
  .ai-estimation-h2 {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: clamp(1.85rem, 4.5vw, 4.5rem);
    font-weight: 700; line-height: 1.1; color: #111827; margin-bottom: 14px;
  }
  .ai-estimation-body {
    font-size: clamp(0.84rem, 1.8vw, 0.86rem); color: #6B7280; line-height: 1.75; margin-bottom: 22px;
  }
  .ai-estimation-check {
    display: flex; align-items: center; gap: 9px;
    font-size: clamp(0.82rem, 1.8vw, 0.83rem); color: #374151;
  }

  /* ══ AVIS ══ */
  .ai-reviews-section { padding: var(--py) 0; background: #F8F8F8; }
  .ai-reviews-head {
    display: flex; flex-direction: column; gap: 14px;
    margin-bottom: clamp(24px, 4.5vw, 36px);
  }
  @media (min-width: 640px) {
    .ai-reviews-head { flex-direction: row; align-items: flex-end; justify-content: space-between; }
  }
  .ai-reviews-h2 {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: clamp(1.85rem, 4.5vw, 4.5rem);
    font-weight: 300; line-height: 1.1; color: #111827;
  }
  .ai-review-btn {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 10px 18px; border-radius: 5px; font-weight: 600; color: #fff;
    font-size: 0.72rem; flex-shrink: 0; white-space: nowrap;
    font-family: 'DM Sans', sans-serif; border: none; cursor: pointer;
    letter-spacing: 0.06em; text-transform: uppercase;
  }
  .ai-reviews-grid {
    display: grid; grid-template-columns: 1fr; gap: 12px;
  }
  @media (min-width: 560px) { .ai-reviews-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (min-width: 1024px) { .ai-reviews-grid { grid-template-columns: repeat(3, 1fr); } }

  /* ══ BTN ══ */
  .ai-btn-primary {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 11px 22px; border-radius: 5px;
    font-family: 'DM Sans', sans-serif; font-size: 0.76rem; font-weight: 600;
    color: #fff; text-decoration: none; transition: all 0.22s; letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .ai-btn-primary:hover { transform: translateY(-2px); }
`;

const FadeIn = ({ children, delay = 0, x = 0, y = 20 }) => (
    <motion.div
        initial={{ opacity: 0, x, y }}
        whileInView={{ opacity: 1, x: 0, y: 0 }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{ duration: 0.65, delay, ease: [0.25, 0.46, 0.45, 0.94] }}>
        {children}
    </motion.div>
);

const PropertySkeleton = () => (
    <div className="ai-skeleton-card">
        <div className="ai-skeleton-img" />
        <div className="ai-skeleton-body">
            <div className="ai-skeleton-line" style={{ width: '68%' }} />
            <div className="ai-skeleton-line" style={{ width: '100%' }} />
            <div className="ai-skeleton-line" style={{ width: '42%', marginTop: '4px' }} />
        </div>
    </div>
);

/* ─── Panneau recherche — monté via portal dans <body>, position fixed ─── */
const SearchPanel = ({ onClose, onSearch, anchorRef, panelRef }) => {
    const [typeBien,    setTypeBien]    = useState('Tous');
    const [transaction, setTransaction] = useState('vente');
    const [budgetIdx,   setBudgetIdx]   = useState(0);
    const [pos, setPos] = React.useState({ bottom: 0, left: 0, width: 0 });

    React.useLayoutEffect(() => {
        if (!anchorRef?.current) return;
        const rect = anchorRef.current.getBoundingClientRect();
        const panelW = Math.min(window.innerWidth * 0.92, 560);
        const centreX = rect.left + rect.width / 2;
        const leftX = Math.max(8, Math.min(centreX - panelW / 2, window.innerWidth - panelW - 8));
        // bottom = distance depuis le bas du viewport jusqu'au dessus de l'ancre + 8px gap
        const bottomFromViewport = window.innerHeight - rect.top + 8;
        setPos({ bottom: bottomFromViewport, left: leftX, width: panelW });
    }, [anchorRef]);

    const handleSubmit = () => { onSearch({ typeBien, transaction, budgetIdx }); onClose(); };

    const panel = (
        <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.20, ease: [0.22, 1, 0.36, 1] }}
            style={{
                position: 'fixed',
                bottom: pos.bottom,
                left: pos.left,
                width: pos.width,
                background: 'rgba(8,10,14,0.97)',
                backdropFilter: 'blur(28px)',
                WebkitBackdropFilter: 'blur(28px)',
                border: '1px solid rgba(255,255,255,0.11)',
                borderRadius: '14px',
                padding: '18px',
                boxShadow: '0 -8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
                zIndex: 9999,
            }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
                <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'0.64rem', fontWeight:600, letterSpacing:'0.14em', textTransform:'uppercase', color:'rgba(255,255,255,0.4)' }}>
                    Rechercher un bien
                </span>
                <button onClick={onClose} aria-label="Fermer la recherche" style={{
                    padding:'5px', borderRadius:'6px', background:'rgba(255,255,255,0.05)',
                    border:'1px solid rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.35)', cursor:'pointer',
                    display:'flex', alignItems:'center',
                }}>
                    <X size={13} aria-hidden="true" />
                </button>
            </div>
            <div className="ai-panel-filters">
                {[
                    { label:'Transaction', value:transaction, setter:setTransaction,               options:TRANSACTIONS.map(t=>({v:t.value,l:t.label})) },
                    { label:'Type de bien', value:typeBien,   setter:setTypeBien,                  options:TYPES_BIENS.map(t=>({v:t,l:t})) },
                    { label:'Budget',       value:budgetIdx,  setter:(v)=>setBudgetIdx(Number(v)), options:BUDGETS.map((b,i)=>({v:i,l:b.label})) },
                ].map(({ label, value, setter, options }) => (
                    <div key={label} style={{ position:'relative' }}>
                        <label className="ai-panel-label">{label}</label>
                        <div style={{ position:'relative' }}>
                            <select value={value} onChange={e=>setter(e.target.value)} className="ai-panel-select">
                                {options.map(o=><option key={o.v} value={o.v} className="text-gray-900">{o.l}</option>)}
                            </select>
                            <ChevronDown style={{ position:'absolute', right:'9px', top:'50%', transform:'translateY(-50%)', width:'12px', height:'12px', color:'rgba(255,255,255,0.32)', pointerEvents:'none' }} />
                        </div>
                    </div>
                ))}
            </div>
            <button onClick={handleSubmit} className="ai-panel-search-btn">
                <Search size={14} aria-hidden="true" />
                Rechercher
            </button>
        </motion.div>
    );

    return createPortal(panel, document.body);
};

/* ─────────────────────────────────────────────────────────────
   PAGE
───────────────────────────────────────────────────────────── */
const AltimmoPage = () => {
    const router = useRouter();
    const { user } = useAuth();

    const [properties,     setProperties]    = useState([]);
    const [reviews,        setReviews]        = useState([]);
    const [loading,        setLoading]        = useState(true);
    const [loadError,      setLoadError]      = useState(false);
    const [reviewsLoading, setReviewsLoading] = useState(true);
    const [searchOpen,     setSearchOpen]     = useState(false);
    const pillRef  = useRef(null);
    const panelRef = useRef(null);

    useEffect(() => {
        if (!searchOpen) return;
        const handleClickOutside = (e) => {
            if (pillRef.current?.contains(e.target)) return;
            if (panelRef.current?.contains(e.target)) return;
            setSearchOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [searchOpen]);

    const handleSearch = ({ typeBien, transaction, budgetIdx }) => {
        const params = new URLSearchParams();
        params.set('status', transaction);
        if (typeBien !== 'Tous') params.set('type', typeBien);
        const budget = BUDGETS[budgetIdx];
        if (budget.min) params.set('priceMin', budget.min);
        if (budget.max) params.set('priceMax', budget.max);
        router.push(`/immobilier/annonces?${params.toString()}`);
    };

    const handleScrollToContact = (e) => {
        e.preventDefault();
        document.getElementById('contact-altimmo')?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleLeaveReview = () =>
        router.push(user ? '/avis/nouveau' : '/login');

    useEffect(() => {
        const fetchProperties = async () => {
            try { setProperties((await getLatestPropertiesByPole('Altimmo', 6)) || []); }
            catch { setLoadError(true); } finally { setLoading(false); }
        };
        const fetchReviews = async () => {
            try { setReviews((await getAltimmoReviews(6)) || []); }
            catch { setReviews([]); } finally { setReviewsLoading(false); }
        };
        fetchProperties(); fetchReviews();
    }, []);

    return (
        <div className="ai-page" style={{ minHeight:'100vh', background:'#F8F8F8' }}>
            <style>{PAGE_CSS}</style>


            {/* ══ HERO ════════════════════════════════════════════════ */}
            <header style={{
                position:'relative', color:'#fff', overflow:'hidden',
                height:'100svh', minHeight:'620px', maxHeight:'860px',
            }}>
                <HeroSliderAlt />

                {/* ── SearchPanel : ancré directement sur le header, s'ouvre vers le haut ── */}
                <AnimatePresence>
                    {searchOpen && (
                        <SearchPanel onClose={() => setSearchOpen(false)} onSearch={handleSearch} anchorRef={pillRef} panelRef={panelRef} />
                    )}
                </AnimatePresence>

                {/* ── Zone actions : pill recherche + liens fins ── */}
                <div className="ai-hero-actions">
                    {/* Pill recherche — principal et compact */}
                    <motion.button
                        ref={pillRef}
                        onClick={() => setSearchOpen(!searchOpen)}
                        initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
                        transition={{ delay:0.5, duration:0.45 }}
                        className="ai-search-pill"
                        style={{
                            background: searchOpen
                                ? `linear-gradient(135deg, ${BLUE}, ${BLUE_DARK})`
                                : 'rgba(8,10,14,0.60)',
                            backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)',
                            border: searchOpen ? `1px solid ${BLUE}55` : '1px solid rgba(255,255,255,0.15)',
                            boxShadow: searchOpen ? `0 4px 20px ${BLUE}40` : '0 2px 14px rgba(0,0,0,0.28)',
                        }}
                        aria-label="Rechercher un bien immobilier"
                        aria-expanded={searchOpen}>
                        <Search size={13} aria-hidden="true" />
                        Rechercher un bien
                        <ChevronDown size={11} style={{
                            opacity:0.55,
                            transform: searchOpen ? 'rotate(180deg)' : 'rotate(0)',
                            transition:'transform 0.22s',
                        }} />
                    </motion.button>

                    {/* Liens secondaires — discrets */}
                    <motion.div
                        initial={{ opacity:0 }} animate={{ opacity:1 }}
                        transition={{ delay:0.62, duration:0.4 }}
                        className="ai-hero-links">
                        <Link href="/immobilier/annonces" className="ai-hero-link">
                            <Sparkles size={11} aria-hidden="true" />
                            Toutes les annonces
                        </Link>
                        <div className="ai-hero-link-sep" />
                        <a href="#contact-altimmo" onClick={handleScrollToContact} className="ai-hero-link">
                            <Handshake size={11} aria-hidden="true" />
                            Nous contacter
                        </a>
                    </motion.div>
                </div>

                {/* ── Bande atouts — compacte ── */}
                <div style={{ position:'absolute', bottom:0, left:0, right:0, zIndex:10 }}>
                    <div style={{ height:'1px', background:'linear-gradient(to right,transparent,rgba(255,255,255,0.07),transparent)' }} />
                    <div className="ai-atouts-grid" style={{ backdropFilter:'blur(12px)', background:'rgba(0,0,0,0.35)' }}>
                        {ATOUTS.map(({ icon:Icon, label, color }, i) => (
                            <div key={i} className="ai-atout-item">
                                <Icon size={13} style={{ color, flexShrink:0 }} aria-hidden="true" />
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
                        <FadeIn x={-24}>
                            <p className="ai-eyebrow" style={{ color:BLUE }}>Notre approche</p>
                            <h2 className="ai-about-h2">L'Excellence au Service<br />de Vos Projets</h2>
                            <div style={{ height:'2px', width:'48px', borderRadius:'2px', marginBottom:'20px', background:`linear-gradient(to right,${BLUE},${GOLD})` }} />
                            <p className="ai-about-body">
                                Forts d'une connaissance approfondie du marché immobilier de Brazzaville, nous offrons une approche personnalisée, alliant{' '}
                                <strong style={{ color:'#111827' }}>innovation</strong>,{' '}
                                <strong style={{ color:'#111827' }}>expertise légale</strong> et{' '}
                                <strong style={{ color:'#111827' }}>écoute attentive</strong>.
                            </p>
                            <ul style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'28px' }}>
                                {['Estimation gratuite et sans engagement','Accompagnement juridique inclus',"Réseau d'acquéreurs qualifiés",'Transparence totale sur les frais'].map((item,i) => (
                                    <li key={i} className="ai-about-check">
                                        <CheckCircle size={14} style={{ color:BLUE, flexShrink:0 }} />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                            <Link href="/immobilier/annonces" className="ai-btn-primary"
                                style={{ background:`linear-gradient(135deg,${BLUE},${BLUE_DARK})`, boxShadow:`0 3px 16px ${BLUE}28` }}>
                                Découvrir nos biens <ArrowRight size={14} />
                            </Link>
                        </FadeIn>
                        <FadeIn x={24} delay={0.1}>
                            <div className="ai-stats-grid">
                                {[
                                    { value:'200+', label:'Biens vendus',       color:BLUE      },
                                    { value:'98%',  label:'Clients satisfaits', color:GOLD      },
                                    { value:'5 ans',label:"D'expérience",       color:BLUE_DARK },
                                    { value:'24h',  label:'Délai de réponse',   color:BLUE      },
                                ].map(({ value, label, color },i) => (
                                    <FadeIn key={i} delay={0.15+i*0.07} y={14}>
                                        <div className="ai-stat-card" style={{ backgroundColor:`${color}08`, borderColor:`${color}18` }}>
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
                        <div style={{ textAlign:'center', marginBottom:'clamp(32px,5.5vw,44px)' }}>
                            <p className="ai-eyebrow" style={{ color:BLUE, justifyContent:'center' }}>Nos Engagements</p>
                            <h2 className="ai-h2">Une Expertise à Votre Mesure</h2>
                        </div>
                    </FadeIn>
                    <div className="ai-services-grid">
                        {SERVICES.map((service,i) => {
                            const Icon = service.icon;
                            return (
                                <FadeIn key={i} delay={i*0.09} y={28}>
                                    <div className="ai-service-card" style={{ borderColor:`${service.color}18` }}>
                                        <div className="ai-service-accent" style={{ position:'absolute', top:0, left:0, right:0, height:'2px', background:service.color, opacity:0, transition:'0.3s' }} />
                                        <div style={{ width:'44px', height:'44px', borderRadius:'12px', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'16px', background:`${service.color}12`, border:`1px solid ${service.color}22` }}>
                                            <Icon size={20} style={{ color:service.color }} />
                                        </div>
                                        <span style={{ display:'inline-block', fontSize:'0.64rem', fontWeight:700, padding:'3px 9px', borderRadius:'40px', marginBottom:'10px', background:`${service.color}10`, color:service.color }}>
                                            {service.stat}
                                        </span>
                                        <h3 className="ai-service-title">{service.title}</h3>
                                        <p className="ai-service-desc">{service.desc}</p>
                                        <Link href={`/immobilier/services/${service.slug}`} className="ai-service-cta" style={{ color:service.color }}>
                                            En savoir plus <ArrowRight size={13} />
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
                            <p className="ai-eyebrow" style={{ color:BLUE }}>Notre Sélection</p>
                            <h2 className="ai-properties-h2">Biens Immobiliers Récents</h2>
                        </FadeIn>
                        <Link href="/immobilier/annonces" className="ai-properties-link" style={{ color:BLUE }}>
                            Voir toutes les annonces <ArrowRight size={13} />
                        </Link>
                    </div>
                    {loadError && (
                        <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'12px 16px', borderRadius:'10px', marginBottom:'16px', background:`${BLUE}08`, border:`1px solid ${BLUE}22`, fontSize:'0.82rem', color:'#374151' }}>
                            ⚠️ Impossible de charger les biens pour le moment. Réessayez plus tard.
                        </div>
                    )}
                    {loading ? (
                        <div className="ai-properties-grid">{[1,2,3].map(i=><PropertySkeleton key={i} />)}</div>
                    ) : properties.length === 0 ? (
                        <div style={{ textAlign:'center', padding:'clamp(36px,7vw,72px) 20px', borderRadius:'20px', border:`1px dashed ${BLUE}28`, background:`${BLUE}03` }}>
                            <div style={{ width:'48px', height:'48px', borderRadius:'14px', background:`linear-gradient(135deg,${BLUE},${BLUE_DARK})`, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' }}>
                                <Home size={22} color="#fff" />
                            </div>
                            <p style={{ fontWeight:500, color:'#111827', marginBottom:'5px', fontSize:'clamp(0.90rem,2vw,0.95rem)' }}>Aucune annonce disponible</p>
                            <p style={{ fontSize:'clamp(0.80rem,1.8vw,0.84rem)', color:'#6B7280' }}>Les nouvelles annonces seront bientôt disponibles</p>
                        </div>
                    ) : (
                        <div className="ai-properties-grid">
                            {properties.map((property,index) => (
                                <FadeIn key={property._id} delay={index*0.05} y={18}>
                                    <PropertyCard property={property} />
                                </FadeIn>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* ══ ESTIMATION ══════════════════════════════════════════ */}
            <section className="ai-estimation-section">
                <div style={{ position:'absolute', inset:0, pointerEvents:'none' }}>
                    <div style={{ position:'absolute', top:0, left:'25%', width:'300px', height:'300px', borderRadius:'50%', filter:'blur(110px)', opacity:0.09, background:BLUE }} />
                    <div style={{ position:'absolute', bottom:0, right:'25%', width:'300px', height:'300px', borderRadius:'50%', filter:'blur(110px)', opacity:0.07, background:GOLD }} />
                </div>
                <div style={{ position:'absolute', top:0, left:0, right:0, height:'1px', background:`linear-gradient(to right,transparent,${BLUE}38,transparent)` }} />
                <div className="ai-container" style={{ position:'relative', zIndex:10 }}>
                    <div className="ai-estimation-grid">
                        <FadeIn x={-22}>
                            <div style={{ width:'44px', height:'44px', borderRadius:'12px', background:`linear-gradient(135deg,${GOLD},#E5A84B)`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'18px' }}>
                                <Calculator size={20} color="#fff" />
                            </div>
                            <p className="ai-eyebrow" style={{ color:GOLD }}>Estimation gratuite</p>
                            <h2 className="ai-estimation-h2">Quelle est la valeur<br />de votre bien ?</h2>
                            <div style={{ height:'2px', width:'36px', borderRadius:'2px', marginBottom:'16px', background:`linear-gradient(to right,${GOLD},${BLUE})` }} />
                            <p className="ai-estimation-body">
                                Remplissez le formulaire. Notre équipe vous contacte sous{' '}
                                <strong style={{ color:'rgba(255,255,255,0.82)' }}>24h</strong> avec une estimation personnalisée et sans engagement.
                            </p>
                            <ul style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                                {[
                                    { icon:CheckCircle, text:'100% gratuit, sans engagement'      },
                                    { icon:Clock,       text:'Réponse garantie sous 24h'          },
                                    { icon:ShieldCheck, text:'Expertise marché local Brazzaville' },
                                    { icon:Mail,        text:'Confirmation par email immédiate'   },
                                ].map(({ icon:Icon, text },i) => (
                                    <li key={i} className="ai-estimation-check">
                                        <Icon size={13} style={{ color:GOLD, flexShrink:0 }} /> {text}
                                    </li>
                                ))}
                            </ul>
                        </FadeIn>
                        <FadeIn x={22} delay={0.1}><EstimationForm /></FadeIn>
                    </div>
                </div>
            </section>

            {/* ══ AVIS ════════════════════════════════════════════════ */}
            <section className="ai-reviews-section">
                <div className="ai-container">
                    <div className="ai-reviews-head">
                        <FadeIn>
                            <p className="ai-eyebrow" style={{ color:BLUE }}>Témoignages</p>
                            <h2 className="ai-reviews-h2">Ils Nous Font Confiance</h2>
                        </FadeIn>
                        <motion.button onClick={handleLeaveReview}
                            whileHover={{ scale:1.03 }} whileTap={{ scale:0.97 }}
                            className="ai-review-btn"
                            style={{ background:`linear-gradient(135deg,${BLUE},${BLUE_DARK})`, boxShadow:`0 3px 14px ${BLUE}28` }}>
                            <MessageSquarePlus size={14} />
                            Laisser un avis
                            {!user && <span style={{ opacity:0.5, fontSize:'0.64rem', fontWeight:400 }}>(connexion)</span>}
                        </motion.button>
                    </div>
                    {reviewsLoading ? (
                        <div className="ai-reviews-grid">
                            {[1,2,3].map(i=>(
                                <div key={i} style={{ background:'#FFFFFF', borderRadius:'10px', padding:'20px', border:'1px solid rgba(17,24,39,0.08)', animation:'aiSkeleton 2s ease-in-out infinite' }}>
                                    <div style={{ display:'flex', gap:'10px', marginBottom:'14px' }}>
                                        <div style={{ width:'36px', height:'36px', background:'#E5E7EB', borderRadius:'50%', flexShrink:0 }} />
                                        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:'7px' }}>
                                            <div style={{ height:'11px', background:'#E5E7EB', borderRadius:'5px', width:'58%' }} />
                                            <div style={{ height:'9px', background:'#F3F4F6', borderRadius:'4px', width:'32%' }} />
                                        </div>
                                    </div>
                                    <div style={{ display:'flex', flexDirection:'column', gap:'7px' }}>
                                        <div style={{ height:'11px', background:'#F3F4F6', borderRadius:'5px' }} />
                                        <div style={{ height:'11px', background:'#F3F4F6', borderRadius:'5px', width:'78%' }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : reviews.length > 0 ? (
                        <div className="ai-reviews-grid">
                            {reviews.map((review,index) => (
                                <FadeIn key={review._id} delay={index*0.06} y={18}><ReviewCard review={review} /></FadeIn>
                            ))}
                        </div>
                    ) : (
                        <div style={{ textAlign:'center', padding:'clamp(36px,7vw,64px) 20px', borderRadius:'10px', border:`1px dashed rgba(46,123,181,0.22)`, background:'rgba(46,123,181,0.03)' }}>
                            <Star size={24} style={{ color:'#9CA3AF', margin:'0 auto 10px', display:'block' }} />
                            <p style={{ fontWeight:500, color:'#111827', marginBottom:'5px', fontSize:'clamp(0.90rem,2vw,0.95rem)' }}>Aucun avis pour le moment</p>
                            <p style={{ fontSize:'clamp(0.80rem,1.8vw,0.84rem)', color:'#6B7280' }}>Soyez le premier à partager votre expérience !</p>
                        </div>
                    )}
                </div>
            </section>

            {/* ══ CONTACT ═════════════════════════════════════════════ */}
            <AltimmoContact />

            {/* ══ CTA ═════════════════════════════════════════════════ */}
            <section style={{ padding:'clamp(36px,7vw,52px) 0', background:'#F8F8F8' }}>
                <div className="ai-container"><CtaCommission /></div>
            </section>

        </div>
    );
};

export default AltimmoPage;