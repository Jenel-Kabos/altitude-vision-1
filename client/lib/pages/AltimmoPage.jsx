"use client";
import React, { useState, useEffect } from 'react';
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

import { getLatestPropertiesByPole } from '../services/propertyService';
import { getAltimmoReviews }         from '../services/reviewService';
import { useAuth }                   from '../context/AuthContext';
import { PROPERTY_TYPES_WITH_ALL }   from '../constants/propertyTypes';

const GOLD      = '#C8960C';
const GOLD_DARK = '#9A710A';
const BLUE      = '#2E7BB5';
const BLUE_DARK = '#1A5A8A';

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

const PAGE_CSS = `
  .ai-page {
    font-family: 'DM Sans', -apple-system, sans-serif;
    --px: 20px; --py: clamp(52px, 9vw, 140px);
  }
  @media (min-width: 640px)  { .ai-page { --px: 36px; } }
  @media (min-width: 1024px) { .ai-page { --px: 48px; } }
  @media (min-width: 1440px) { .ai-page { --px: 80px; --py: 140px; } }

  .ai-container { max-width: 1400px; margin: 0 auto; padding: 0 var(--px); }

  .ai-eyebrow {
    font-family: 'DM Sans', sans-serif;
    font-size: 0.64rem; font-weight: 700;
    letter-spacing: 0.18em; text-transform: uppercase; margin-bottom: 12px;
    display: flex; align-items: center;
  }
  .ai-h2 {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: clamp(2rem, 5.5vw, 4.5rem);
    font-weight: 700; line-height: 1.08; color: #111827;
  }

  .ai-hero-search {
    display: flex; flex-wrap: wrap;
    background: rgba(9,11,14,0.75);
    backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
    border: 1px solid rgba(200,150,12,0.22);
    width: 100%; max-width: 760px;
    margin-top: 32px; overflow: hidden;
  }
  .ai-hero-field {
    flex: 1 1 160px; display: flex; flex-direction: column;
    padding: 12px 16px;
    border-right: 1px solid rgba(255,255,255,0.07);
    border-bottom: 1px solid rgba(255,255,255,0.04);
    min-width: 0;
  }
  @media (min-width: 640px) {
    .ai-hero-field { border-bottom: none; padding: 14px 18px; }
  }
  .ai-hero-field-label {
    font-family: 'DM Sans', sans-serif;
    font-size: 0.56rem; font-weight: 700;
    letter-spacing: 0.15em; text-transform: uppercase;
    color: rgba(200,150,12,0.7); margin-bottom: 4px;
  }
  .ai-hero-select {
    appearance: none; background: transparent;
    border: none; outline: none;
    font-family: 'DM Sans', sans-serif;
    font-size: 0.82rem; font-weight: 500;
    color: #F0EDE8; cursor: pointer; width: 100%; padding-right: 18px;
  }
  .ai-hero-select option { color: #1A1612; background: #F0EDE8; }
  .ai-hero-search-btn {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 14px 28px; background: #C8960C;
    border: none; cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    font-size: 0.76rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
    color: #0A0C0F; white-space: nowrap; transition: background 0.2s;
    min-height: 44px; min-width: 140px; flex: 0 0 auto;
    border-left: 1px solid rgba(255,255,255,0.07);
  }
  .ai-hero-search-btn:hover { background: #DCA815; }

  .ai-hero-links { display: flex; align-items: center; gap: 20px; margin-top: 20px; }
  .ai-hero-link {
    display: inline-flex; align-items: center; gap: 5px;
    color: rgba(255,255,255,0.45); font-family: 'DM Sans', sans-serif;
    font-size: 0.64rem; font-weight: 400; letter-spacing: 0.08em; text-transform: uppercase;
    text-decoration: none; transition: color 0.2s; white-space: nowrap;
  }
  .ai-hero-link:hover { color: rgba(255,255,255,0.8); }
  .ai-hero-link-sep { width: 1px; height: 12px; background: rgba(255,255,255,0.15); }

  .ai-atouts-grid { display: grid; grid-template-columns: repeat(2, 1fr); }
  @media (min-width: 640px) { .ai-atouts-grid { grid-template-columns: repeat(4, 1fr); } }
  .ai-atout-item {
    display: flex; align-items: center; gap: 8px; padding: 10px 14px;
    border-right: 1px solid rgba(255,255,255,0.07);
  }
  .ai-atout-item:nth-child(2n) { border-right: none; }
  @media (min-width: 640px) {
    .ai-atout-item { padding: 12px 18px; }
    .ai-atout-item:nth-child(2) { border-right: 1px solid rgba(255,255,255,0.07); }
    .ai-atout-item:last-child { border-right: none; }
  }
  .ai-atout-label {
    color: rgba(255,255,255,0.6); font-family: 'DM Sans', sans-serif;
    font-size: 0.68rem; font-weight: 400;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  .ai-about-section { padding: var(--py) 0; background: #FDFCFA; overflow: hidden; }
  .ai-about-grid { display: grid; grid-template-columns: 1fr; gap: clamp(36px, 7vw, 64px); align-items: center; }
  @media (min-width: 1024px) { .ai-about-grid { grid-template-columns: 1fr 1fr; } }
  .ai-about-h2 {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: clamp(2rem, 5.5vw, 4.5rem);
    font-weight: 700; line-height: 1.08; color: #1A1612; margin-bottom: 18px;
  }
  .ai-about-body {
    font-family: 'DM Sans', sans-serif;
    font-size: clamp(0.90rem, 2vw, 1rem); color: #6B5D52; line-height: 1.75; margin-bottom: 18px;
  }
  .ai-about-check {
    display: flex; align-items: center; gap: 10px;
    font-family: 'DM Sans', sans-serif; font-size: clamp(0.84rem, 2vw, 0.86rem); color: #6B5D52;
  }
  .ai-stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .ai-stat-card { padding: clamp(18px, 3.5vw, 26px); border: 1px solid; text-align: center; }
  .ai-stat-num {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(2rem, 6vw, 4.5rem); font-weight: 700; line-height: 1; margin-bottom: 4px;
  }
  .ai-stat-label { font-family: 'DM Sans', sans-serif; font-size: 0.68rem; color: #9A8A7A; font-weight: 500; }

  .ai-services-section { padding: var(--py) 0; background: #F5F3EF; }
  .ai-services-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
  @media (min-width: 768px) { .ai-services-grid { grid-template-columns: repeat(3, 1fr); } }
  .ai-service-card {
    background: #FDFCFA; padding: clamp(22px, 4vw, 32px);
    border: 1px solid; position: relative; overflow: hidden;
    transition: box-shadow 0.3s, border-color 0.3s;
  }
  .ai-service-card:hover { box-shadow: 0 16px 48px rgba(26,22,18,0.1); }
  .ai-service-card:hover .ai-service-accent { height: 3px !important; }
  .ai-service-title {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: clamp(1.05rem, 2.5vw, 1.2rem); font-weight: 600; color: #1A1612; margin-bottom: 8px;
  }
  .ai-service-desc {
    font-family: 'DM Sans', sans-serif;
    font-size: clamp(0.83rem, 1.8vw, 0.875rem); color: #6B5D52; line-height: 1.7; margin-bottom: 20px;
  }
  .ai-service-cta {
    display: inline-flex; align-items: center; gap: 6px;
    font-family: 'DM Sans', sans-serif; font-size: 0.72rem; font-weight: 600;
    letter-spacing: 0.06em; text-transform: uppercase; text-decoration: none; transition: gap 0.2s;
  }
  .ai-service-cta:hover { gap: 10px !important; }

  .ai-properties-section { padding: var(--py) 0; background: #FDFCFA; }
  .ai-properties-head { display: flex; flex-direction: column; gap: 14px; margin-bottom: clamp(28px, 5vw, 44px); }
  @media (min-width: 640px) {
    .ai-properties-head { flex-direction: row; align-items: flex-end; justify-content: space-between; }
  }
  .ai-properties-h2 {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: clamp(1.85rem, 4.5vw, 4.5rem); font-weight: 700; line-height: 1.1; color: #1A1612;
  }
  .ai-properties-link {
    display: inline-flex; align-items: center; gap: 5px; font-family: 'DM Sans', sans-serif;
    font-size: 0.78rem; font-weight: 600; white-space: nowrap; flex-shrink: 0; text-decoration: none;
  }
  .ai-properties-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
  @media (min-width: 560px)  { .ai-properties-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (min-width: 1024px) { .ai-properties-grid { grid-template-columns: repeat(3, 1fr); } }

  .ai-skeleton-card { overflow: hidden; border: 1px solid rgba(200,150,12,0.12); background: #FDFCFA; animation: aiSkeleton 2s ease-in-out infinite; }
  .ai-skeleton-img  { height: 210px; background: #EDE9E3; }
  .ai-skeleton-body { padding: 18px; display: flex; flex-direction: column; gap: 9px; }
  .ai-skeleton-line { height: 12px; background: #EDE9E3; }
  @keyframes aiSkeleton { 0%,100%{opacity:1} 50%{opacity:.55} }

  .ai-estimation-section {
    padding: var(--py) 0; position: relative; overflow: hidden;
    background: linear-gradient(135deg, #090B0E 0%, #0e1e30 60%, #090B0E 100%);
  }
  .ai-estimation-grid { display: grid; grid-template-columns: 1fr; gap: clamp(36px, 7vw, 60px); align-items: start; }
  @media (min-width: 1024px) { .ai-estimation-grid { grid-template-columns: 2fr 3fr; } }
  .ai-estimation-h2 {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: clamp(1.85rem, 4.5vw, 4.5rem); font-weight: 700; line-height: 1.1; color: #F0EDE8; margin-bottom: 14px;
  }
  .ai-estimation-body {
    font-family: 'DM Sans', sans-serif;
    font-size: clamp(0.84rem, 1.8vw, 0.86rem); color: rgba(240,237,232,0.55); line-height: 1.75; margin-bottom: 22px;
  }
  .ai-estimation-check {
    display: flex; align-items: center; gap: 9px; font-family: 'DM Sans', sans-serif;
    font-size: clamp(0.82rem, 1.8vw, 0.83rem); color: rgba(240,237,232,0.55);
  }

  .ai-reviews-section { padding: var(--py) 0; background: #F5F3EF; }
  .ai-reviews-head { display: flex; flex-direction: column; gap: 14px; margin-bottom: clamp(24px, 4.5vw, 36px); }
  @media (min-width: 640px) {
    .ai-reviews-head { flex-direction: row; align-items: flex-end; justify-content: space-between; }
  }
  .ai-reviews-h2 {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: clamp(1.85rem, 4.5vw, 4.5rem); font-weight: 700; line-height: 1.1; color: #1A1612;
  }
  .ai-reviews-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
  @media (min-width: 560px)  { .ai-reviews-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (min-width: 1024px) { .ai-reviews-grid { grid-template-columns: repeat(3, 1fr); } }
  .ai-review-btn {
    display: inline-flex; align-items: center; gap: 7px; padding: 12px 20px;
    font-weight: 700; color: #0A0C0F; font-family: 'DM Sans', sans-serif;
    font-size: 0.72rem; flex-shrink: 0; white-space: nowrap; border: none; cursor: pointer;
    letter-spacing: 0.07em; text-transform: uppercase; min-height: 44px;
  }
  .ai-btn-primary {
    display: inline-flex; align-items: center; gap: 7px; padding: 12px 22px;
    font-family: 'DM Sans', sans-serif; font-size: 0.76rem; font-weight: 700;
    color: #0A0C0F; text-decoration: none; transition: background 0.2s;
    letter-spacing: 0.07em; text-transform: uppercase; min-height: 44px;
    border: none; cursor: pointer;
  }
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

const HeroSearch = ({ onSearch }) => {
    const [transaction, setTransaction] = useState('vente');
    const [typeBien,    setTypeBien]    = useState('Tous');
    const [budgetIdx,   setBudgetIdx]   = useState(0);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSearch({ typeBien, transaction, budgetIdx });
    };

    return (
        <form onSubmit={handleSubmit} className="ai-hero-search" role="search" aria-label="Recherche immobilière">
            <div className="ai-hero-field">
                <label className="ai-hero-field-label">Transaction</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <select className="ai-hero-select" value={transaction} onChange={e => setTransaction(e.target.value)} aria-label="Type de transaction">
                        {TRANSACTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <ChevronDown size={11} color="rgba(200,150,12,0.6)" style={{ position: 'absolute', right: 0, pointerEvents: 'none', flexShrink: 0 }} />
                </div>
            </div>

            <div className="ai-hero-field">
                <label className="ai-hero-field-label">Type de bien</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <select className="ai-hero-select" value={typeBien} onChange={e => setTypeBien(e.target.value)} aria-label="Type de bien">
                        {TYPES_BIENS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <ChevronDown size={11} color="rgba(200,150,12,0.6)" style={{ position: 'absolute', right: 0, pointerEvents: 'none', flexShrink: 0 }} />
                </div>
            </div>

            <div className="ai-hero-field" style={{ borderRight: 'none' }}>
                <label className="ai-hero-field-label">Budget</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <select className="ai-hero-select" value={budgetIdx} onChange={e => setBudgetIdx(Number(e.target.value))} aria-label="Budget">
                        {BUDGETS.map((b, i) => <option key={i} value={i}>{b.label}</option>)}
                    </select>
                    <ChevronDown size={11} color="rgba(200,150,12,0.6)" style={{ position: 'absolute', right: 0, pointerEvents: 'none', flexShrink: 0 }} />
                </div>
            </div>

            <button type="submit" className="ai-hero-search-btn">
                <Search size={14} aria-hidden="true" />
                Rechercher
            </button>
        </form>
    );
};

const AltimmoPage = () => {
    const router = useRouter();
    const { user } = useAuth();

    const [properties,     setProperties]    = useState([]);
    const [reviews,        setReviews]        = useState([]);
    const [loading,        setLoading]        = useState(true);
    const [reviewsLoading, setReviewsLoading] = useState(true);

    const handleSearch = ({ typeBien, transaction, budgetIdx }) => {
        const params = new URLSearchParams();
        params.set('status', transaction);
        if (typeBien !== 'Tous') params.set('type', typeBien);
        const budget = BUDGETS[budgetIdx];
        if (budget.min) params.set('priceMin', budget.min);
        if (budget.max) params.set('priceMax', budget.max);
        router.push(`/altimmo/annonces?${params.toString()}`);
    };

    const handleScrollToContact = (e) => {
        e.preventDefault();
        document.getElementById('contact-altimmo')?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleLeaveReview = () => router.push(user ? '/avis/nouveau' : '/login');

    useEffect(() => {
        const fetchProperties = async () => {
            try { setProperties((await getLatestPropertiesByPole('Altimmo', 6)) || []); }
            catch {} finally { setLoading(false); }
        };
        const fetchReviews = async () => {
            try { setReviews((await getAltimmoReviews(6)) || []); }
            catch { setReviews([]); } finally { setReviewsLoading(false); }
        };
        fetchProperties(); fetchReviews();
    }, []);

    return (
        <div className="ai-page" style={{ minHeight: '100vh', background: '#FDFCFA' }}>
            <style>{PAGE_CSS}</style>

            {/* ══ HERO ════════════════════════════════════════════════ */}
            <header style={{
                position: 'relative', color: '#F0EDE8', overflow: 'hidden',
                minHeight: '100svh', display: 'flex', flexDirection: 'column', justifyContent: 'center',
            }}>
                <HeroSliderAlt />
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`, zIndex: 20 }} />

                <div style={{
                    position: 'relative', zIndex: 20,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
                    padding: '0 clamp(16px, 4vw, 48px)',
                    paddingBottom: 'clamp(100px, 14vw, 148px)',
                    maxWidth: 900, margin: '0 auto', width: '100%',
                }}>
                    <motion.p
                        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15, duration: 0.5 }}
                        style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(200,150,12,0.75)', marginBottom: 20 }}>
                        Altimmo · Immobilier Brazzaville
                    </motion.p>

                    <motion.h1
                        initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25, duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
                        style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(2.4rem, 6vw, 5rem)', fontWeight: 700, lineHeight: 1.08, color: '#F0EDE8', marginBottom: 18 }}>
                        Trouvez votre bien<br />à Brazzaville
                    </motion.h1>

                    <motion.div
                        initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
                        transition={{ delay: 0.45, duration: 0.4 }}
                        style={{ height: 2, width: 56, background: `linear-gradient(90deg, ${GOLD}, transparent)`, marginBottom: 18, transformOrigin: 'left' }}
                    />

                    <motion.p
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        transition={{ delay: 0.5, duration: 0.5 }}
                        style={{ fontFamily: "'DM Sans', sans-serif", color: 'rgba(240,237,232,0.52)', lineHeight: 1.7, marginBottom: 0, fontSize: 'clamp(0.875rem, 1.8vw, 1rem)', maxWidth: 500 }}>
                        Appartements, villas, terrains et bureaux — sélection premium avec accompagnement expert.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6, duration: 0.5 }}
                        style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                        <HeroSearch onSearch={handleSearch} />
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        transition={{ delay: 0.75, duration: 0.4 }}
                        className="ai-hero-links">
                        <Link href="/altimmo/annonces" className="ai-hero-link">
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

                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10 }}>
                    <div style={{ height: 1, background: 'linear-gradient(to right, transparent, rgba(200,150,12,0.18), transparent)' }} />
                    <div className="ai-atouts-grid" style={{ backdropFilter: 'blur(12px)', background: 'rgba(0,0,0,0.40)' }}>
                        {ATOUTS.map(({ icon: Icon, label, color }, i) => (
                            <div key={i} className="ai-atout-item">
                                <Icon size={13} style={{ color, flexShrink: 0 }} aria-hidden="true" />
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
                            <p className="ai-eyebrow" style={{ color: BLUE }}>Notre approche</p>
                            <h2 className="ai-about-h2">L'Excellence au Service<br />de Vos Projets</h2>
                            <div style={{ height: 2, width: 48, marginBottom: 20, background: `linear-gradient(to right, ${GOLD}, ${BLUE})` }} />
                            <p className="ai-about-body">
                                Forts d'une connaissance approfondie du marché immobilier de Brazzaville, nous offrons une approche personnalisée, alliant{' '}
                                <strong style={{ color: '#1A1612' }}>innovation</strong>,{' '}
                                <strong style={{ color: '#1A1612' }}>expertise légale</strong> et{' '}
                                <strong style={{ color: '#1A1612' }}>écoute attentive</strong>.
                            </p>
                            <ul style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
                                {['Estimation gratuite et sans engagement', 'Accompagnement juridique inclus', "Réseau d'acquéreurs qualifiés", 'Transparence totale sur les frais'].map((item, i) => (
                                    <li key={i} className="ai-about-check">
                                        <CheckCircle size={14} style={{ color: BLUE, flexShrink: 0 }} />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                            <Link href="/altimmo/annonces" className="ai-btn-primary" style={{ background: GOLD, display: 'inline-flex' }}>
                                Découvrir nos biens <ArrowRight size={14} />
                            </Link>
                        </FadeIn>
                        <FadeIn x={24} delay={0.1}>
                            <div className="ai-stats-grid">
                                {[
                                    { value: '200+', label: 'Biens vendus',       color: BLUE      },
                                    { value: '98%',  label: 'Clients satisfaits', color: GOLD      },
                                    { value: '5 ans', label: "D'expérience",      color: BLUE_DARK },
                                    { value: '24h',  label: 'Délai de réponse',   color: BLUE      },
                                ].map(({ value, label, color }, i) => (
                                    <FadeIn key={i} delay={0.15 + i * 0.07} y={14}>
                                        <div className="ai-stat-card" style={{ backgroundColor: `${color}08`, borderColor: `${color}18` }}>
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
                        <div style={{ textAlign: 'center', marginBottom: 'clamp(32px,5.5vw,44px)' }}>
                            <p className="ai-eyebrow" style={{ color: GOLD, justifyContent: 'center' }}>Nos Engagements</p>
                            <h2 className="ai-h2">Une Expertise à Votre Mesure</h2>
                        </div>
                    </FadeIn>
                    <div className="ai-services-grid">
                        {SERVICES.map((service, i) => {
                            const Icon = service.icon;
                            return (
                                <FadeIn key={i} delay={i * 0.09} y={28}>
                                    <div className="ai-service-card" style={{ borderColor: `${service.color}18` }}>
                                        <div className="ai-service-accent" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: service.color, transition: '0.3s' }} />
                                        <div style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, background: `${service.color}10`, border: `1px solid ${service.color}22` }}>
                                            <Icon size={20} style={{ color: service.color }} />
                                        </div>
                                        <span style={{ display: 'inline-block', fontSize: '0.64rem', fontWeight: 700, padding: '3px 9px', marginBottom: 10, background: `${service.color}10`, color: service.color, fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.06em' }}>
                                            {service.stat}
                                        </span>
                                        <h3 className="ai-service-title">{service.title}</h3>
                                        <p className="ai-service-desc">{service.desc}</p>
                                        <Link href={`/altimmo/services/${service.slug}`} className="ai-service-cta" style={{ color: service.color }}>
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
                            <p className="ai-eyebrow" style={{ color: BLUE }}>Notre Sélection</p>
                            <h2 className="ai-properties-h2">Biens Immobiliers Récents</h2>
                        </FadeIn>
                        <Link href="/altimmo/annonces" className="ai-properties-link" style={{ color: BLUE }}>
                            Voir toutes les annonces <ArrowRight size={13} />
                        </Link>
                    </div>
                    {loading ? (
                        <div className="ai-properties-grid">{[1, 2, 3].map(i => <PropertySkeleton key={i} />)}</div>
                    ) : properties.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 'clamp(36px,7vw,72px) 20px', border: '1px dashed rgba(200,150,12,0.2)', background: 'rgba(200,150,12,0.02)' }}>
                            <div style={{ width: 48, height: 48, background: `linear-gradient(135deg, ${GOLD_DARK}, ${GOLD})`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                                <Home size={22} color="#0A0C0F" />
                            </div>
                            <p style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, color: '#1A1612', marginBottom: 5, fontSize: 'clamp(1rem,2vw,1.1rem)' }}>Aucune annonce disponible</p>
                            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', color: '#6B5D52' }}>Les nouvelles annonces seront bientôt disponibles</p>
                        </div>
                    ) : (
                        <div className="ai-properties-grid">
                            {properties.map((property, index) => (
                                <FadeIn key={property._id} delay={index * 0.05} y={18}>
                                    <PropertyCard property={property} />
                                </FadeIn>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* ══ ESTIMATION ══════════════════════════════════════════ */}
            <section className="ai-estimation-section">
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                    <div style={{ position: 'absolute', top: 0, left: '25%', width: 300, height: 300, filter: 'blur(110px)', opacity: 0.08, background: BLUE, borderRadius: '50%' }} />
                    <div style={{ position: 'absolute', bottom: 0, right: '25%', width: 300, height: 300, filter: 'blur(110px)', opacity: 0.07, background: GOLD, borderRadius: '50%' }} />
                </div>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(to right, transparent, rgba(200,150,12,0.28), transparent)' }} />
                <div className="ai-container" style={{ position: 'relative', zIndex: 10 }}>
                    <div className="ai-estimation-grid">
                        <FadeIn x={-22}>
                            <div style={{ width: 44, height: 44, background: `linear-gradient(135deg, ${GOLD_DARK}, ${GOLD})`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                                <Calculator size={20} color="#0A0C0F" />
                            </div>
                            <p className="ai-eyebrow" style={{ color: GOLD }}>Estimation gratuite</p>
                            <h2 className="ai-estimation-h2">Quelle est la valeur<br />de votre bien ?</h2>
                            <div style={{ height: 2, width: 36, marginBottom: 16, background: `linear-gradient(to right, ${GOLD}, ${BLUE})` }} />
                            <p className="ai-estimation-body">
                                Remplissez le formulaire. Notre équipe vous contacte sous{' '}
                                <strong style={{ color: 'rgba(240,237,232,0.85)' }}>24h</strong> avec une estimation personnalisée et sans engagement.
                            </p>
                            <ul style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {[
                                    { icon: CheckCircle, text: '100% gratuit, sans engagement'      },
                                    { icon: Clock,       text: 'Réponse garantie sous 24h'          },
                                    { icon: ShieldCheck, text: 'Expertise marché local Brazzaville' },
                                    { icon: Mail,        text: 'Confirmation par email immédiate'   },
                                ].map(({ icon: Icon, text }, i) => (
                                    <li key={i} className="ai-estimation-check">
                                        <Icon size={13} style={{ color: GOLD, flexShrink: 0 }} /> {text}
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
                            <p className="ai-eyebrow" style={{ color: GOLD }}>Témoignages</p>
                            <h2 className="ai-reviews-h2">Ils Nous Font Confiance</h2>
                        </FadeIn>
                        <motion.button
                            onClick={handleLeaveReview}
                            whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
                            className="ai-review-btn"
                            style={{ background: GOLD, boxShadow: '0 4px 16px rgba(200,150,12,0.28)' }}>
                            <MessageSquarePlus size={14} />
                            Laisser un avis
                            {!user && <span style={{ opacity: 0.5, fontSize: '0.64rem', fontWeight: 400 }}>(connexion)</span>}
                        </motion.button>
                    </div>
                    {reviewsLoading ? (
                        <div className="ai-reviews-grid">
                            {[1, 2, 3].map(i => (
                                <div key={i} style={{ background: '#FDFCFA', padding: 20, border: '1px solid rgba(200,150,12,0.12)', animation: 'aiSkeleton 2s ease-in-out infinite' }}>
                                    <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                                        <div style={{ width: 36, height: 36, background: '#EDE9E3', flexShrink: 0 }} />
                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
                                            <div style={{ height: 11, background: '#EDE9E3', width: '58%' }} />
                                            <div style={{ height: 9, background: '#F0EDE8', width: '32%' }} />
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                                        <div style={{ height: 11, background: '#F0EDE8' }} />
                                        <div style={{ height: 11, background: '#F0EDE8', width: '78%' }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : reviews.length > 0 ? (
                        <div className="ai-reviews-grid">
                            {reviews.map((review, index) => (
                                <FadeIn key={review._id} delay={index * 0.06} y={18}><ReviewCard review={review} /></FadeIn>
                            ))}
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: 'clamp(36px,7vw,64px) 20px', border: '1px dashed rgba(200,150,12,0.2)', background: 'rgba(200,150,12,0.02)' }}>
                            <Star size={24} style={{ color: 'rgba(200,150,12,0.3)', margin: '0 auto 10px', display: 'block' }} />
                            <p style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, color: '#1A1612', marginBottom: 5, fontSize: 'clamp(1rem,2vw,1.1rem)' }}>Aucun avis pour le moment</p>
                            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', color: '#6B5D52' }}>Soyez le premier à partager votre expérience !</p>
                        </div>
                    )}
                </div>
            </section>

            {/* ══ CTA ═════════════════════════════════════════════════ */}
            <section style={{ padding: 'clamp(36px,7vw,52px) 0', background: '#FDFCFA' }}>
                <div className="ai-container"><CtaCommission /></div>
            </section>

        </div>
    );
};

export default AltimmoPage;