import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
    ArrowRight, Sparkles, MessageSquarePlus, Star,
    Search, Home, Building2, TrendingUp, Key,
    Handshake, MapPin, ChevronDown, Calculator,
    ShieldCheck, Clock, Award, CheckCircle,
} from 'lucide-react';

import HeroSliderAlt   from '../components/HeroSliderAlt';
import AltimmoContact  from '../components/AltimmoContact';
import PropertyCard    from '../components/PropertyCard';
import ReviewCard      from '../components/ReviewCard';
import CtaCommission   from '../components/CtaCommission';

import { getLatestPropertiesByPole } from '../services/propertyService';
import { getAltimmoReviews }         from '../services/reviewService';
import { useAuth }                   from '../context/AuthContext';
import SEOHead                       from '../components/SEOHead';

// ─────────────────────────────────────────────────────────────
// Données statiques
// ─────────────────────────────────────────────────────────────
const SERVICES = [
    {
        icon:    Key,
        title:   'Vente de Biens',
        desc:    'Nous vous accompagnons à chaque étape pour vendre votre propriété au meilleur prix et dans les meilleurs délais.',
        slug:    'vente-de-biens',
        color:   '#2E7BB5',
        stat:    '+120 ventes',
    },
    {
        icon:    Building2,
        title:   'Location & Gestion',
        desc:    "Confiez-nous la location et la gestion de vos biens pour une tranquillité d'esprit et une rentabilité optimale.",
        slug:    'location-gestion',
        color:   '#1A5A8A',
        stat:    '+80 biens gérés',
    },
    {
        icon:    TrendingUp,
        title:   'Conseil en Investissement',
        desc:    'Bénéficiez de notre expertise du marché local pour réaliser des investissements immobiliers judicieux et performants.',
        slug:    'conseil-investissement',
        color:   '#C8872A',
        stat:    '+50 projets',
    },
];

const TYPES_BIENS = ['Tous', 'Villa', 'Appartement', 'Bureau', 'Terrain', 'Commerce'];
const TRANSACTIONS = ['Vente', 'Location'];
const BUDGETS = ['Tous les budgets', '< 50M FCFA', '50M – 150M', '150M – 500M', '> 500M FCFA'];

const ATOUTS = [
    { icon: ShieldCheck, label: 'Transactions sécurisées',   color: '#2E7BB5' },
    { icon: Clock,       label: 'Réponse sous 24h',          color: '#C8872A' },
    { icon: Award,       label: 'Experts certifiés',         color: '#2E7BB5' },
    { icon: MapPin,      label: 'Ancrage local Brazzaville', color: '#C8872A' },
];

// ─────────────────────────────────────────────────────────────
// Skeleton loader
// ─────────────────────────────────────────────────────────────
const PropertySkeleton = () => (
    <div className="animate-pulse bg-white rounded-3xl overflow-hidden border border-gray-100">
        <div className="bg-gray-200 h-52" />
        <div className="p-5 space-y-3">
            <div className="h-4 bg-gray-100 rounded-full w-3/4" />
            <div className="h-3 bg-gray-100 rounded-full w-full" />
            <div className="h-3 bg-gray-100 rounded-full w-2/3" />
            <div className="h-8 bg-gray-100 rounded-xl w-1/3 mt-4" />
        </div>
    </div>
);

// ─────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────
const AltimmoPage = () => {
    const navigate      = useNavigate();
    const { user }      = useAuth();

    const [properties,     setProperties]     = useState([]);
    const [reviews,        setReviews]         = useState([]);
    const [loading,        setLoading]         = useState(true);
    const [reviewsLoading, setReviewsLoading]  = useState(true);
    const [error,          setError]           = useState(null);

    // Barre de recherche
    const [typeBien,    setTypeBien]    = useState('Tous');
    const [transaction, setTransaction] = useState('Vente');
    const [budget,      setBudget]      = useState('Tous les budgets');

    const handleSearch = () => {
        const params = new URLSearchParams();
        if (typeBien    !== 'Tous')              params.set('type',        typeBien);
        if (transaction)                         params.set('transaction', transaction);
        if (budget      !== 'Tous les budgets')  params.set('budget',      budget);
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
            try {
                const result = await getLatestPropertiesByPole('Altimmo', 6);
                setProperties(result || []);
            } catch {
                setError('Impossible de charger les annonces.');
            } finally {
                setLoading(false);
            }
        };
        const fetchReviews = async () => {
            try {
                const data = await getAltimmoReviews(6);
                setReviews(data || []);
            } catch {
                setReviews([]);
            } finally {
                setReviewsLoading(false);
            }
        };
        fetchProperties();
        fetchReviews();
    }, []);

    return (
        <div className="min-h-screen bg-white" style={{ fontFamily: "'Outfit', sans-serif" }}>


            <SEOHead
                title="Altimmo — Immobilier à Brazzaville"
                description="Parcourez les annonces immobilières à Brazzaville : appartements, maisons, terrains et bureaux disponibles à la vente et à la location."
                url="/altimmo"
                breadcrumb={[
                    { name: 'Accueil', path: '/' },
                    { name: 'Altimmo', path: '/altimmo' },
                ]}
            />

            {/* ══════════════════════════════════════════
                HERO + BARRE DE RECHERCHE
            ══════════════════════════════════════════ */}
            <header className="relative text-white overflow-hidden"
                style={{ height: 'calc(100vh - 0px)', minHeight: '640px', maxHeight: '860px' }}>

                <HeroSliderAlt />

                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/70 z-[1]" />

                <div className="absolute inset-0 z-10 flex flex-col justify-center px-4 sm:px-8 lg:px-16">
                    <div className="max-w-6xl mx-auto w-full">

                        {/* Badge */}
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest text-white border border-white/20 backdrop-blur-sm mb-5"
                            style={{ backgroundColor: 'rgba(46,123,181,0.25)' }}
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-[#2E7BB5] animate-pulse" />
                            Altimmo — Immobilier de Prestige
                        </motion.div>

                        {/* Titre */}
                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.15, duration: 0.7 }}
                            className="text-white mb-4 max-w-3xl"
                            style={{
                                fontFamily: "'Cormorant Garamond', Georgia, serif",
                                fontSize:   'clamp(2.5rem, 5.5vw, 5rem)',
                                fontWeight: 700,
                                lineHeight: 1.1,
                                letterSpacing: '-0.02em',
                            }}
                        >
                            Immobilier de Luxe
                            <span className="block" style={{ color: '#7BB8E0' }}>
                                & Conseil Expert
                            </span>
                        </motion.h1>

                        {/* Ligne décorative */}
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: '64px' }}
                            transition={{ delay: 0.4, duration: 0.6 }}
                            className="h-0.5 rounded-full mb-5"
                            style={{ background: 'linear-gradient(to right, #2E7BB5, #C8872A)' }}
                        />

                        {/* Sous-titre */}
                        <motion.p
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3, duration: 0.7 }}
                            className="text-white/75 max-w-xl mb-8 leading-relaxed"
                            style={{ fontSize: 'clamp(0.95rem, 1.6vw, 1.15rem)', fontWeight: 300 }}
                        >
                            Votre partenaire de confiance pour concrétiser vos ambitions immobilières avec élégance et sérénité.
                        </motion.p>

                        {/* ── Barre de recherche ──────────────── */}
                        <motion.div
                            initial={{ opacity: 0, y: 24 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5, duration: 0.7 }}
                            className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-3 max-w-3xl"
                        >
                            <div className="flex flex-col sm:flex-row gap-2">

                                {/* Type de bien */}
                                <div className="relative flex-1">
                                    <label className="absolute -top-2 left-3 text-[10px] font-bold uppercase tracking-wider text-white/60 bg-transparent px-1">
                                        Type
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={typeBien}
                                            onChange={e => setTypeBien(e.target.value)}
                                            className="w-full appearance-none bg-white/10 border border-white/15 text-white text-sm rounded-xl px-4 py-3 pr-8 focus:outline-none focus:border-white/40 transition-colors cursor-pointer"
                                            style={{ fontFamily: "'Outfit', sans-serif" }}
                                        >
                                            {TYPES_BIENS.map(t => <option key={t} value={t} className="text-gray-900">{t}</option>)}
                                        </select>
                                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 pointer-events-none" />
                                    </div>
                                </div>

                                {/* Transaction */}
                                <div className="relative flex-1">
                                    <label className="absolute -top-2 left-3 text-[10px] font-bold uppercase tracking-wider text-white/60 px-1">
                                        Transaction
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={transaction}
                                            onChange={e => setTransaction(e.target.value)}
                                            className="w-full appearance-none bg-white/10 border border-white/15 text-white text-sm rounded-xl px-4 py-3 pr-8 focus:outline-none focus:border-white/40 transition-colors cursor-pointer"
                                            style={{ fontFamily: "'Outfit', sans-serif" }}
                                        >
                                            {TRANSACTIONS.map(t => <option key={t} value={t} className="text-gray-900">{t}</option>)}
                                        </select>
                                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 pointer-events-none" />
                                    </div>
                                </div>

                                {/* Budget */}
                                <div className="relative flex-1">
                                    <label className="absolute -top-2 left-3 text-[10px] font-bold uppercase tracking-wider text-white/60 px-1">
                                        Budget
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={budget}
                                            onChange={e => setBudget(e.target.value)}
                                            className="w-full appearance-none bg-white/10 border border-white/15 text-white text-sm rounded-xl px-4 py-3 pr-8 focus:outline-none focus:border-white/40 transition-colors cursor-pointer"
                                            style={{ fontFamily: "'Outfit', sans-serif" }}
                                        >
                                            {BUDGETS.map(b => <option key={b} value={b} className="text-gray-900">{b}</option>)}
                                        </select>
                                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 pointer-events-none" />
                                    </div>
                                </div>

                                {/* Bouton recherche */}
                                <button
                                    onClick={handleSearch}
                                    className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-white text-sm transition-all duration-300 hover:scale-105 flex-shrink-0"
                                    style={{
                                        background: 'linear-gradient(135deg, #2E7BB5, #1A5A8A)',
                                        boxShadow:  '0 4px 20px rgba(46,123,181,0.4)',
                                        fontFamily: "'Outfit', sans-serif",
                                    }}
                                >
                                    <Search className="w-4 h-4" />
                                    Rechercher
                                </button>
                            </div>
                        </motion.div>

                        {/* CTA secondaire */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.7 }}
                            className="mt-5 flex flex-wrap gap-3"
                        >
                            <Link to="/altimmo/annonces"
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white border border-white/20 hover:bg-white/15 backdrop-blur-sm transition-all duration-200"
                                style={{ fontFamily: "'Outfit', sans-serif" }}
                            >
                                <Sparkles className="w-4 h-4" />
                                Voir tous nos biens
                            </Link>
                            <a href="#contact-altimmo" onClick={handleScrollToContact}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white border border-white/20 hover:bg-white/15 backdrop-blur-sm transition-all duration-200"
                                style={{ fontFamily: "'Outfit', sans-serif" }}
                            >
                                <Handshake className="w-4 h-4" />
                                Nous contacter
                            </a>
                        </motion.div>
                    </div>
                </div>

                {/* Atouts en bas du hero */}
                <div className="absolute bottom-0 left-0 right-0 z-10">
                    <div className="h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.1), transparent)' }} />
                    <div className="backdrop-blur-md bg-black/30 grid grid-cols-2 sm:grid-cols-4 divide-x divide-white/10">
                        {ATOUTS.map(({ icon: Icon, label, color }, i) => (
                            <div key={i} className="flex items-center gap-2.5 px-5 py-3.5">
                                <Icon className="w-4 h-4 flex-shrink-0" style={{ color }} />
                                <span className="text-white/70 text-xs font-medium"
                                    style={{ fontFamily: "'Outfit', sans-serif" }}>{label}</span>
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

                        {/* Gauche — texte */}
                        <motion.div
                            initial={{ opacity: 0, x: -30 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.7 }}
                            className="mb-12 lg:mb-0"
                        >
                            <p className="text-xs font-bold uppercase tracking-widest mb-4"
                                style={{ color: '#2E7BB5' }}>
                                Notre approche
                            </p>
                            <h2 className="text-gray-900 mb-5"
                                style={{
                                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                                    fontSize:   'clamp(2rem, 4vw, 3.2rem)',
                                    fontWeight: 700,
                                    lineHeight: 1.1,
                                }}>
                                L'Excellence au Service de Vos Projets
                            </h2>
                            <div className="h-0.5 w-16 rounded-full mb-6"
                                style={{ background: 'linear-gradient(to right, #2E7BB5, #C8872A)' }} />
                            <p className="text-gray-600 leading-relaxed mb-6 text-base sm:text-lg">
                                Forts d'une connaissance approfondie du marché, nous offrons une approche personnalisée, alliant{' '}
                                <span className="font-semibold text-gray-900">innovation</span>,{' '}
                                <span className="font-semibold text-gray-900">expertise légale</span> et{' '}
                                <span className="font-semibold text-gray-900">écoute attentive</span> pour garantir la réussite de chaque transaction.
                            </p>

                            {/* Checklist */}
                            <ul className="space-y-3 mb-8">
                                {[
                                    'Estimation gratuite et sans engagement',
                                    'Accompagnement juridique inclus',
                                    'Réseau d\'acquéreurs qualifiés',
                                    'Transparence totale sur les frais',
                                ].map((item, i) => (
                                    <li key={i} className="flex items-center gap-3 text-sm text-gray-600">
                                        <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#2E7BB5' }} />
                                        {item}
                                    </li>
                                ))}
                            </ul>

                            <Link to="/altimmo/annonces"
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-white text-sm transition-all duration-300 hover:scale-105 hover:shadow-xl group"
                                style={{
                                    background: 'linear-gradient(135deg, #2E7BB5, #1A5A8A)',
                                    boxShadow:  '0 4px 20px rgba(46,123,181,0.3)',
                                    fontFamily: "'Outfit', sans-serif",
                                }}
                            >
                                Découvrir nos biens
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        </motion.div>

                        {/* Droite — stats */}
                        <motion.div
                            initial={{ opacity: 0, x: 30 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.7, delay: 0.1 }}
                            className="grid grid-cols-2 gap-4"
                        >
                            {[
                                { value: '200+', label: 'Biens vendus',        color: '#2E7BB5' },
                                { value: '98%',  label: 'Clients satisfaits',  color: '#C8872A' },
                                { value: '5 ans',label: "D'expérience",        color: '#1A5A8A' },
                                { value: '24h',  label: 'Délai de réponse',    color: '#2E7BB5' },
                            ].map(({ value, label, color }, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: 0.2 + i * 0.1 }}
                                    className="p-6 rounded-2xl border text-center"
                                    style={{
                                        backgroundColor: `${color}08`,
                                        borderColor:     `${color}20`,
                                    }}
                                >
                                    <p className="mb-1"
                                        style={{
                                            fontFamily: "'Cormorant Garamond', serif",
                                            fontSize:   '2.5rem',
                                            fontWeight: 700,
                                            color,
                                            lineHeight: 1,
                                        }}>
                                        {value}
                                    </p>
                                    <p className="text-xs text-gray-500 font-medium"
                                        style={{ fontFamily: "'Outfit', sans-serif" }}>
                                        {label}
                                    </p>
                                </motion.div>
                            ))}
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════
                NOS SERVICES
            ══════════════════════════════════════════ */}
            <section className="py-16 sm:py-20 bg-gray-50 relative overflow-hidden">

                {/* Décoration */}
                <div className="absolute right-0 top-0 bottom-0 w-px opacity-20"
                    style={{ background: 'linear-gradient(to bottom, transparent, #2E7BB5, transparent)' }} />

                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <motion.div
                        className="text-center mb-12"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                    >
                        <p className="text-xs font-bold uppercase tracking-widest mb-3"
                            style={{ color: '#2E7BB5' }}>
                            Nos Engagements
                        </p>
                        <h2 className="text-gray-900 mb-3"
                            style={{
                                fontFamily: "'Cormorant Garamond', Georgia, serif",
                                fontSize:   'clamp(2rem, 4vw, 3rem)',
                                fontWeight: 700,
                                lineHeight: 1.1,
                            }}>
                            Une Expertise à Votre Mesure
                        </h2>
                        <p className="text-gray-500 text-sm max-w-xl mx-auto">
                            Chaque service est conçu pour maximiser votre rendement et simplifier votre expérience
                        </p>
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        {SERVICES.map((service, i) => {
                            const Icon = service.icon;
                            return (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 30 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true, amount: 0.2 }}
                                    transition={{ duration: 0.5, delay: i * 0.1 }}
                                    whileHover={{ y: -6 }}
                                    className="group relative bg-white rounded-3xl p-7 border transition-all duration-500 hover:shadow-xl overflow-hidden"
                                    style={{ borderColor: `${service.color}20` }}
                                >
                                    {/* Ligne colorée haut au hover */}
                                    <div className="absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                        style={{ backgroundColor: service.color }} />

                                    {/* Halo fond */}
                                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                                        style={{ background: `radial-gradient(circle at 20% 50%, ${service.color}08, transparent 70%)` }} />

                                    {/* Icône */}
                                    <div className="w-13 h-13 w-12 h-12 rounded-2xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110 shadow-sm"
                                        style={{ backgroundColor: `${service.color}15`, border: `1px solid ${service.color}25` }}>
                                        <Icon className="w-6 h-6" style={{ color: service.color }} />
                                    </div>

                                    {/* Stat badge */}
                                    <span className="inline-block text-xs font-bold px-2.5 py-1 rounded-full mb-3"
                                        style={{ backgroundColor: `${service.color}12`, color: service.color }}>
                                        {service.stat}
                                    </span>

                                    <h3 className="font-bold text-gray-900 text-lg mb-2 transition-colors duration-300"
                                        style={{ fontFamily: "'Outfit', sans-serif" }}>
                                        {service.title}
                                    </h3>
                                    <p className="text-gray-500 text-sm leading-relaxed mb-5">
                                        {service.desc}
                                    </p>

                                    <Link to={`/altimmo/services/${service.slug}`}
                                        className="inline-flex items-center gap-2 text-sm font-semibold transition-all duration-300 group-hover:gap-3"
                                        style={{ color: service.color }}>
                                        En savoir plus
                                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </Link>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════
                BIENS RÉCENTS
            ══════════════════════════════════════════ */}
            <section className="py-16 sm:py-20 bg-white">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">

                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                        >
                            <p className="text-xs font-bold uppercase tracking-widest mb-2"
                                style={{ color: '#2E7BB5' }}>
                                Notre Sélection
                            </p>
                            <h2 className="text-gray-900"
                                style={{
                                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                                    fontSize:   'clamp(1.8rem, 3.5vw, 2.8rem)',
                                    fontWeight: 700,
                                    lineHeight: 1.1,
                                }}>
                                Biens Immobiliers Récents
                            </h2>
                        </motion.div>
                        <Link to="/altimmo/annonces"
                            className="inline-flex items-center gap-2 text-sm font-semibold transition-all group flex-shrink-0"
                            style={{ color: '#2E7BB5' }}>
                            Voir toutes les annonces
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </Link>
                    </div>

                    {error && (
                        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl mb-8 max-w-xl">
                            <span className="text-red-500 text-lg">⚠️</span>
                            <p className="text-red-700 text-sm font-medium">{error}</p>
                        </div>
                    )}

                    {loading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            {[1,2,3].map(i => <PropertySkeleton key={i} />)}
                        </div>
                    ) : properties.length === 0 && !error ? (
                        <div className="text-center py-16 rounded-3xl border border-dashed"
                            style={{ borderColor: 'rgba(46,123,181,0.3)', backgroundColor: 'rgba(46,123,181,0.04)' }}>
                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                                style={{ background: 'linear-gradient(135deg, #2E7BB5, #1A5A8A)' }}>
                                <Home className="w-8 h-8 text-white" />
                            </div>
                            <p className="font-bold text-gray-700 mb-1">Aucune annonce disponible</p>
                            <p className="text-sm text-gray-500">Les nouvelles annonces seront bientôt disponibles</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            {properties.map((property, index) => (
                                <motion.div
                                    key={property._id}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true, amount: 0.1 }}
                                    transition={{ duration: 0.4, delay: index * 0.05 }}
                                >
                                    <PropertyCard property={property} />
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* ══════════════════════════════════════════
                ESTIMATION RAPIDE — Générateur de leads
            ══════════════════════════════════════════ */}
            <section className="py-16 sm:py-20 relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #0D1117 0%, #111827 60%, #0D1117 100%)' }}>

                {/* Halos */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-0 left-1/4 w-80 h-80 rounded-full blur-[120px] opacity-10"
                        style={{ background: '#2E7BB5' }} />
                    <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full blur-[120px] opacity-8"
                        style={{ background: '#C8872A' }} />
                </div>
                <div className="absolute top-0 left-0 right-0 h-px"
                    style={{ background: 'linear-gradient(to right, transparent, rgba(46,123,181,0.4), transparent)' }} />

                <div className="container mx-auto px-4 sm:px-6 max-w-6xl relative z-10">
                    <div className="lg:grid lg:grid-cols-2 lg:gap-16 lg:items-center">

                        {/* Texte */}
                        <motion.div
                            initial={{ opacity: 0, x: -30 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.7 }}
                        >
                            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
                                style={{ background: 'linear-gradient(135deg, #C8872A, #E5A84B)' }}>
                                <Calculator className="w-6 h-6 text-white" />
                            </div>
                            <p className="text-xs font-bold uppercase tracking-widest mb-3"
                                style={{ color: '#C8872A' }}>
                                Estimation gratuite
                            </p>
                            <h2 className="text-white mb-4"
                                style={{
                                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                                    fontSize:   'clamp(1.8rem, 3.5vw, 3rem)',
                                    fontWeight: 700,
                                    lineHeight: 1.1,
                                }}>
                                Quelle est la valeur de votre bien ?
                            </h2>
                            <p className="text-white/60 leading-relaxed mb-6 text-sm">
                                Obtenez une estimation professionnelle et gratuite de votre propriété en moins de 24h. Nos experts analysent le marché local pour vous donner la valeur réelle de votre bien.
                            </p>
                            <ul className="space-y-2.5 mb-8">
                                {['100% gratuit et sans engagement', 'Réponse sous 24h', 'Expertise marché local'].map((item, i) => (
                                    <li key={i} className="flex items-center gap-2.5 text-sm text-white/60">
                                        <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#C8872A' }} />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </motion.div>

                        {/* Card formulaire */}
                        <motion.div
                            initial={{ opacity: 0, x: 30 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.7, delay: 0.1 }}
                            className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-7"
                        >
                            <h3 className="text-white font-bold text-lg mb-5"
                                style={{ fontFamily: "'Outfit', sans-serif" }}>
                                Demande d'estimation
                            </h3>
                            <div className="space-y-3">
                                {[
                                    { placeholder: 'Type de bien (Villa, Appartement...)', type: 'text' },
                                    { placeholder: 'Adresse du bien', type: 'text' },
                                    { placeholder: 'Surface approximative (m²)', type: 'text' },
                                    { placeholder: 'Votre email', type: 'email' },
                                ].map((field, i) => (
                                    <input
                                        key={i}
                                        type={field.type}
                                        placeholder={field.placeholder}
                                        className="w-full px-4 py-3 rounded-xl bg-white/8 border border-white/12 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#2E7BB5]/60 transition-colors"
                                        style={{ fontFamily: "'Outfit', sans-serif" }}
                                    />
                                ))}
                                <motion.a
                                    href="#contact-altimmo"
                                    onClick={handleScrollToContact}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-white text-sm transition-all duration-300 mt-2"
                                    style={{
                                        background: 'linear-gradient(135deg, #C8872A, #E5A84B)',
                                        boxShadow:  '0 4px 20px rgba(200,135,42,0.3)',
                                        fontFamily: "'Outfit', sans-serif",
                                    }}
                                >
                                    <Calculator className="w-4 h-4" />
                                    Demander mon estimation
                                </motion.a>
                                <p className="text-center text-white/30 text-xs mt-2">
                                    Gratuit · Sans engagement · Sous 24h
                                </p>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════
                AVIS CLIENTS
            ══════════════════════════════════════════ */}
            <section className="py-16 sm:py-20 bg-gray-50">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">

                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                        >
                            <p className="text-xs font-bold uppercase tracking-widest mb-2"
                                style={{ color: '#2E7BB5' }}>
                                Témoignages
                            </p>
                            <h2 className="text-gray-900"
                                style={{
                                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                                    fontSize:   'clamp(1.8rem, 3.5vw, 2.8rem)',
                                    fontWeight: 700,
                                    lineHeight: 1.1,
                                }}>
                                Ils Nous Font Confiance
                            </h2>
                        </motion.div>

                        <motion.button
                            onClick={handleLeaveReview}
                            whileHover={{ scale: 1.04 }}
                            whileTap={{ scale: 0.97 }}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-white text-sm flex-shrink-0"
                            style={{
                                background: 'linear-gradient(135deg, #2E7BB5, #1A5A8A)',
                                boxShadow:  '0 4px 16px rgba(46,123,181,0.3)',
                                fontFamily: "'Outfit', sans-serif",
                            }}
                        >
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
                                        <div className="w-10 h-10 bg-gray-200 rounded-full" />
                                        <div className="flex-1 space-y-2">
                                            <div className="h-3 bg-gray-200 rounded-full w-2/3" />
                                            <div className="h-2 bg-gray-100 rounded-full w-1/3" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="h-3 bg-gray-100 rounded-full" />
                                        <div className="h-3 bg-gray-100 rounded-full w-4/5" />
                                        <div className="h-3 bg-gray-100 rounded-full w-3/5" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : reviews.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {reviews.map((review, index) => (
                                <motion.div
                                    key={review._id}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 0.5, delay: index * 0.08 }}
                                >
                                    <ReviewCard review={review} />
                                </motion.div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-14 rounded-3xl border border-dashed"
                            style={{ borderColor: 'rgba(46,123,181,0.25)', backgroundColor: 'rgba(46,123,181,0.03)' }}>
                            <Star className="w-8 h-8 mx-auto mb-3 text-gray-300" />
                            <p className="font-bold text-gray-700 mb-1">Aucun avis pour le moment</p>
                            <p className="text-sm text-gray-500">Soyez le premier à partager votre expérience !</p>
                        </div>
                    )}
                </div>
            </section>

            {/* ══════════════════════════════════════════
                CTA COMMISSION
            ══════════════════════════════════════════ */}
            <section className="py-14 px-4 sm:px-6 bg-white">
                <div className="container mx-auto max-w-6xl">
                    <CtaCommission />
                </div>
            </section>

            {/* ══════════════════════════════════════════
                CONTACT
            ══════════════════════════════════════════ */}
            <AltimmoContact />
        </div>
    );
};

export default AltimmoPage;