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

// ─── Palette ──────────────────────────────────────────────────
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

const PropertySkeleton = () => (
    <div className="animate-pulse bg-white rounded-3xl overflow-hidden border border-gray-100">
        <div className="bg-gray-200 h-52" />
        <div className="p-5 space-y-3">
            <div className="h-4 bg-gray-100 rounded-full w-3/4" />
            <div className="h-3 bg-gray-100 rounded-full w-full" />
            <div className="h-8 bg-gray-100 rounded-xl w-1/3 mt-4" />
        </div>
    </div>
);

// ─── Panneau de recherche flottant ────────────────────────────
const SearchPanel = ({ onClose, onSearch }) => {
    const [typeBien,    setTypeBien]    = useState('Tous');
    const [transaction, setTransaction] = useState('vente');
    const [budgetIdx,   setBudgetIdx]   = useState(0);

    const handleSubmit = () => {
        onSearch({ typeBien, transaction, budgetIdx });
        onClose();
    };

    const selectClass = "w-full appearance-none bg-white/10 border border-white/20 text-white text-sm rounded-xl px-4 py-3 pr-8 focus:outline-none focus:border-white/40 cursor-pointer";

    return (
        <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            style={{
                position: 'absolute',
                bottom: 'calc(100% + 12px)',
                left: '50%',
                transform: 'translateX(-50%)',
                width: 'min(92vw, 680px)',
                background: 'rgba(10,12,15,0.92)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '20px',
                padding: '20px',
                boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
                zIndex: 30,
            }}
        >
            {/* En-tête panneau */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '0.75rem', fontWeight: 600,
                    letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>
                    Rechercher un bien
                </p>
                <button onClick={onClose}
                    style={{ padding: '4px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <X size={14} />
                </button>
            </div>

            {/* Filtres */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                {/* Transaction */}
                <div style={{ position: 'relative' }}>
                    <label style={{ display: 'block', fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.15em',
                        textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>
                        Transaction
                    </label>
                    <div style={{ position: 'relative' }}>
                        <select value={transaction} onChange={e => setTransaction(e.target.value)}
                            className={selectClass} style={{ fontFamily: "'Outfit', sans-serif" }}>
                            {TRANSACTIONS.map(t => <option key={t.value} value={t.value} className="text-gray-900">{t.label}</option>)}
                        </select>
                        <ChevronDown style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                            width: '14px', height: '14px', color: 'rgba(255,255,255,0.35)', pointerEvents: 'none' }} />
                    </div>
                </div>

                {/* Type de bien */}
                <div style={{ position: 'relative' }}>
                    <label style={{ display: 'block', fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.15em',
                        textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>
                        Type de bien
                    </label>
                    <div style={{ position: 'relative' }}>
                        <select value={typeBien} onChange={e => setTypeBien(e.target.value)}
                            className={selectClass} style={{ fontFamily: "'Outfit', sans-serif" }}>
                            {TYPES_BIENS.map(t => <option key={t} value={t} className="text-gray-900">{t}</option>)}
                        </select>
                        <ChevronDown style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                            width: '14px', height: '14px', color: 'rgba(255,255,255,0.35)', pointerEvents: 'none' }} />
                    </div>
                </div>

                {/* Budget */}
                <div style={{ position: 'relative' }}>
                    <label style={{ display: 'block', fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.15em',
                        textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>
                        Budget
                    </label>
                    <div style={{ position: 'relative' }}>
                        <select value={budgetIdx} onChange={e => setBudgetIdx(Number(e.target.value))}
                            className={selectClass} style={{ fontFamily: "'Outfit', sans-serif" }}>
                            {BUDGETS.map((b, i) => <option key={i} value={i} className="text-gray-900">{b.label}</option>)}
                        </select>
                        <ChevronDown style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                            width: '14px', height: '14px', color: 'rgba(255,255,255,0.35)', pointerEvents: 'none' }} />
                    </div>
                </div>
            </div>

            {/* Bouton recherche */}
            <button onClick={handleSubmit}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    padding: '12px', borderRadius: '12px', fontFamily: "'Outfit', sans-serif",
                    fontSize: '0.82rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
                    color: '#fff', cursor: 'pointer', border: 'none',
                    background: `linear-gradient(135deg, ${BLUE}, ${BLUE_DARK})`,
                    boxShadow: `0 4px 20px ${BLUE}50` }}>
                <Search size={15} aria-hidden="true" />
                Rechercher
            </button>
        </motion.div>
    );
};

// ─────────────────────────────────────────────────────────────
const AltimmoPage = () => {
    const navigate  = useNavigate();
    const { user }  = useAuth();

    const [properties,     setProperties]    = useState([]);
    const [reviews,        setReviews]        = useState([]);
    const [loading,        setLoading]        = useState(true);
    const [reviewsLoading, setReviewsLoading] = useState(true);

    // Panneau recherche
    const [searchOpen, setSearchOpen] = useState(false);

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
            try {
                const result = await getLatestPropertiesByPole('Altimmo', 6);
                setProperties(result || []);
            } catch { /* silently ignore */ }
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
        <div className="min-h-screen bg-white" style={{ fontFamily: "'Outfit', sans-serif" }}>

            <SEOHead
                title="Altimmo — Achat, Vente & Location Immobilière à Brazzaville"
                description="Altimmo by Altitude-Vision : trouvez des appartements, maisons et villas à vendre ou à louer à Brazzaville, Congo. Estimation gratuite, accompagnement juridique inclus."
                url="/altimmo"
                image="/og-altimmo.jpg"
                breadcrumb={[
                    { name: 'Accueil', path: '/' },
                    { name: 'Altimmo', path: '/altimmo' },
                ]}
            />

            {/* ══ HERO ═════════════════════════════════════════════════
                Le HeroSliderAlt gère TOUT le contenu narratif (titre,
                sous-titre, eyebrow, CTA, stat, citation). Cette section
                ne contient que les éléments UI propres à la page :
                - Le slider en fond
                - Le raccourci recherche flottant (pill icône loupe)
                - La bande d'atouts en pied de hero
            ════════════════════════════════════════════════════════ */}
            <header className="relative text-white overflow-hidden"
                style={{ height: 'calc(100vh - 0px)', minHeight: '640px', maxHeight: '860px' }}>

                {/* Slider narratif — contient le texte complet */}
                <HeroSliderAlt />

                {/* ── Raccourci recherche + CTA liens ─────────────────
                    Positionné en bas du hero, au-dessus de la bande atouts.
                    Le pill "Rechercher un bien" ouvre le panneau SearchPanel.
                ──────────────────────────────────────────────────── */}
                <div style={{
                    position: 'absolute',
                    bottom: '72px', // au-dessus de la bande atouts (~52px)
                    left: 0, right: 0,
                    zIndex: 20,
                    display: 'flex',
                    justifyContent: 'center',
                    padding: '0 24px',
                }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>

                        {/* Panneau filtres (s'ouvre au-dessus) */}
                        <AnimatePresence>
                            {searchOpen && (
                                <SearchPanel
                                    onClose={() => setSearchOpen(false)}
                                    onSearch={handleSearch}
                                />
                            )}
                        </AnimatePresence>

                        {/* ✅ Pill principal — icône loupe + label */}
                        <motion.button
                            onClick={() => setSearchOpen(!searchOpen)}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5, duration: 0.5 }}
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: '8px',
                                padding: '11px 20px',
                                borderRadius: '40px',
                                background: searchOpen
                                    ? `linear-gradient(135deg, ${BLUE}, ${BLUE_DARK})`
                                    : 'rgba(10,12,15,0.55)',
                                backdropFilter: 'blur(16px)',
                                WebkitBackdropFilter: 'blur(16px)',
                                border: searchOpen
                                    ? `1px solid ${BLUE}60`
                                    : '1px solid rgba(255,255,255,0.18)',
                                color: '#fff',
                                fontFamily: "'Outfit', sans-serif",
                                fontSize: '0.78rem', fontWeight: 500,
                                letterSpacing: '0.06em', textTransform: 'uppercase',
                                cursor: 'pointer',
                                boxShadow: searchOpen ? `0 6px 24px ${BLUE}45` : '0 4px 20px rgba(0,0,0,0.3)',
                                transition: 'all 0.25s ease',
                            }}
                            aria-label="Rechercher un bien immobilier"
                            aria-expanded={searchOpen}
                        >
                            <Search size={15} aria-hidden="true" />
                            Rechercher un bien
                            <ChevronDown size={12} style={{
                                opacity: 0.6,
                                transform: searchOpen ? 'rotate(180deg)' : 'rotate(0)',
                                transition: 'transform 0.25s',
                            }} />
                        </motion.button>

                        {/* CTA secondaires */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6, duration: 0.5 }}
                            style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}
                        >
                            <Link to="/altimmo/annonces"
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                                    padding: '10px 18px', borderRadius: '40px',
                                    background: 'rgba(255,255,255,0.08)',
                                    backdropFilter: 'blur(12px)',
                                    border: '1px solid rgba(255,255,255,0.14)',
                                    color: 'rgba(255,255,255,0.85)',
                                    fontFamily: "'Outfit', sans-serif",
                                    fontSize: '0.75rem', fontWeight: 400,
                                    letterSpacing: '0.05em', textTransform: 'uppercase',
                                    textDecoration: 'none', transition: '0.2s',
                                }}>
                                <Sparkles size={13} aria-hidden="true" />
                                Toutes les annonces
                            </Link>
                            <a href="#contact-altimmo" onClick={handleScrollToContact}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                                    padding: '10px 18px', borderRadius: '40px',
                                    background: 'rgba(255,255,255,0.08)',
                                    backdropFilter: 'blur(12px)',
                                    border: '1px solid rgba(255,255,255,0.14)',
                                    color: 'rgba(255,255,255,0.85)',
                                    fontFamily: "'Outfit', sans-serif",
                                    fontSize: '0.75rem', fontWeight: 400,
                                    letterSpacing: '0.05em', textTransform: 'uppercase',
                                    textDecoration: 'none', transition: '0.2s',
                                }}>
                                <Handshake size={13} aria-hidden="true" />
                                Nous contacter
                            </a>
                        </motion.div>
                    </div>
                </div>

                {/* ── Bande atouts bas du hero ─────────────────────── */}
                <div className="absolute bottom-0 left-0 right-0 z-10">
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
                            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: BLUE }}>Notre approche</p>
                            <h2 className="text-gray-900 mb-5"
                                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(2rem, 4vw, 3.2rem)', fontWeight: 700, lineHeight: 1.1 }}>
                                L'Excellence au Service de Vos Projets
                            </h2>
                            <div className="h-0.5 w-16 rounded-full mb-6" style={{ background: `linear-gradient(to right, ${BLUE}, ${GOLD})` }} />
                            <p className="text-gray-600 leading-relaxed mb-6 text-base sm:text-lg">
                                Forts d'une connaissance approfondie du marché immobilier de Brazzaville, nous offrons une approche personnalisée, alliant{' '}
                                <span className="font-semibold text-gray-900">innovation</span>,{' '}
                                <span className="font-semibold text-gray-900">expertise légale</span> et{' '}
                                <span className="font-semibold text-gray-900">écoute attentive</span>.
                            </p>
                            <ul className="space-y-3 mb-8">
                                {[
                                    'Estimation gratuite et sans engagement',
                                    'Accompagnement juridique inclus',
                                    "Réseau d'acquéreurs qualifiés",
                                    'Transparence totale sur les frais',
                                ].map((item, i) => (
                                    <li key={i} className="flex items-center gap-3 text-sm text-gray-600">
                                        <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: BLUE }} />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                            <Link to="/altimmo/annonces"
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-white text-sm hover:scale-105 hover:shadow-xl transition-all group"
                                style={{ background: `linear-gradient(135deg, ${BLUE}, ${BLUE_DARK})`, boxShadow: `0 4px 20px ${BLUE}30`, fontFamily: "'Outfit', sans-serif" }}>
                                Découvrir nos biens <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        </motion.div>

                        <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.1 }}
                            className="grid grid-cols-2 gap-4">
                            {[
                                { value: '200+', label: 'Biens vendus',       color: BLUE      },
                                { value: '98%',  label: 'Clients satisfaits', color: GOLD      },
                                { value: '5 ans',label: "D'expérience",       color: BLUE_DARK },
                                { value: '24h',  label: 'Délai de réponse',   color: BLUE      },
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
                    <motion.div className="text-center mb-12" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: BLUE }}>Nos Engagements</p>
                        <h2 className="text-gray-900 mb-3"
                            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 700, lineHeight: 1.1 }}>
                            Une Expertise à Votre Mesure
                        </h2>
                    </motion.div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        {SERVICES.map((service, i) => {
                            const Icon = service.icon;
                            return (
                                <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.5, delay: i * 0.1 }}
                                    whileHover={{ y: -6 }}
                                    className="group relative bg-white rounded-3xl p-7 border transition-all duration-500 hover:shadow-xl overflow-hidden"
                                    style={{ borderColor: `${service.color}20` }}>
                                    <div className="absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                        style={{ backgroundColor: service.color }} />
                                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform shadow-sm"
                                        style={{ backgroundColor: `${service.color}15`, border: `1px solid ${service.color}25` }}>
                                        <Icon className="w-6 h-6" style={{ color: service.color }} />
                                    </div>
                                    <span className="inline-block text-xs font-bold px-2.5 py-1 rounded-full mb-3"
                                        style={{ backgroundColor: `${service.color}12`, color: service.color }}>
                                        {service.stat}
                                    </span>
                                    <h3 className="font-bold text-gray-900 text-lg mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>{service.title}</h3>
                                    <p className="text-gray-500 text-sm leading-relaxed mb-5">{service.desc}</p>
                                    <Link to={`/altimmo/services/${service.slug}`}
                                        className="inline-flex items-center gap-2 text-sm font-semibold group-hover:gap-3 transition-all"
                                        style={{ color: service.color }}>
                                        En savoir plus <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </Link>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* ══ BIENS RÉCENTS ════════════════════════════════════════ */}
            <section className="py-16 sm:py-20 bg-white">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
                        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: BLUE }}>Notre Sélection</p>
                            <h2 className="text-gray-900"
                                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)', fontWeight: 700, lineHeight: 1.1 }}>
                                Biens Immobiliers Récents
                            </h2>
                        </motion.div>
                        <Link to="/altimmo/annonces"
                            className="inline-flex items-center gap-2 text-sm font-semibold group flex-shrink-0"
                            style={{ color: BLUE }}>
                            Voir toutes les annonces <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </Link>
                    </div>

                    {loading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            {[1,2,3].map(i => <PropertySkeleton key={i} />)}
                        </div>
                    ) : properties.length === 0 ? (
                        <div className="text-center py-16 rounded-3xl border border-dashed"
                            style={{ borderColor: `${BLUE}30`, backgroundColor: `${BLUE}04` }}>
                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                                style={{ background: `linear-gradient(135deg, ${BLUE}, ${BLUE_DARK})` }}>
                                <Home className="w-8 h-8 text-white" />
                            </div>
                            <p className="font-bold text-gray-700 mb-1">Aucune annonce disponible</p>
                            <p className="text-sm text-gray-500">Les nouvelles annonces seront bientôt disponibles</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            {properties.map((property, index) => (
                                <motion.div key={property._id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true, amount: 0.1 }} transition={{ duration: 0.4, delay: index * 0.05 }}>
                                    <PropertyCard property={property} />
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* ══ ESTIMATION GRATUITE ══════════════════════════════════ */}
            <section id="estimation" className="py-16 sm:py-20 relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #0D1117 0%, #0e1e30 60%, #0D1117 100%)' }}>
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-0 left-1/4 w-80 h-80 rounded-full blur-[120px] opacity-10" style={{ background: BLUE }} />
                    <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full blur-[120px] opacity-8" style={{ background: GOLD }} />
                </div>
                <div className="absolute top-0 left-0 right-0 h-px"
                    style={{ background: `linear-gradient(to right, transparent, ${BLUE}40, transparent)` }} />
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl relative z-10">
                    <div className="lg:grid lg:grid-cols-5 lg:gap-16 lg:items-start">
                        <motion.div className="lg:col-span-2 mb-10 lg:mb-0"
                            initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }} transition={{ duration: 0.7 }}>
                            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
                                style={{ background: `linear-gradient(135deg, ${GOLD}, #E5A84B)` }}>
                                <Calculator className="w-6 h-6 text-white" />
                            </div>
                            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: GOLD }}>Estimation gratuite</p>
                            <h2 className="text-white mb-4"
                                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(1.8rem, 3vw, 2.8rem)', fontWeight: 700, lineHeight: 1.1 }}>
                                Quelle est la valeur de votre bien ?
                            </h2>
                            <div className="h-0.5 w-12 rounded-full mb-5" style={{ background: `linear-gradient(to right, ${GOLD}, ${BLUE})` }} />
                            <p className="text-white/60 leading-relaxed mb-6 text-sm">
                                Remplissez le formulaire ci-contre. Notre équipe analyse votre dossier et vous contacte sous{' '}
                                <strong className="text-white/80">24h</strong> avec une estimation personnalisée et sans engagement.
                            </p>
                            <ul className="space-y-3">
                                {[
                                    { icon: CheckCircle, text: '100% gratuit, sans engagement'      },
                                    { icon: Clock,       text: 'Réponse garantie sous 24h'          },
                                    { icon: ShieldCheck, text: 'Expertise marché local Brazzaville' },
                                    { icon: Mail,        text: 'Confirmation par email immédiate'   },
                                ].map(({ icon: Icon, text }, i) => (
                                    <li key={i} className="flex items-center gap-2.5 text-sm text-white/60">
                                        <Icon className="w-4 h-4 flex-shrink-0" style={{ color: GOLD }} /> {text}
                                    </li>
                                ))}
                            </ul>
                        </motion.div>
                        <motion.div className="lg:col-span-3"
                            initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.1 }}>
                            <EstimationForm />
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* ══ AVIS ═════════════════════════════════════════════════ */}
            <section className="py-16 sm:py-20 bg-gray-50">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
                        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: BLUE }}>Témoignages</p>
                            <h2 className="text-gray-900"
                                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)', fontWeight: 700, lineHeight: 1.1 }}>
                                Ils Nous Font Confiance
                            </h2>
                        </motion.div>
                        <motion.button onClick={handleLeaveReview} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-white text-sm flex-shrink-0"
                            style={{ background: `linear-gradient(135deg, ${BLUE}, ${BLUE_DARK})`, boxShadow: `0 4px 16px ${BLUE}30`, fontFamily: "'Outfit', sans-serif" }}>
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
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : reviews.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {reviews.map((review, index) => (
                                <motion.div key={review._id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }} transition={{ duration: 0.5, delay: index * 0.08 }}>
                                    <ReviewCard review={review} />
                                </motion.div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-14 rounded-3xl border border-dashed"
                            style={{ borderColor: `${BLUE}25`, backgroundColor: `${BLUE}03` }}>
                            <Star className="w-8 h-8 mx-auto mb-3 text-gray-300" />
                            <p className="font-bold text-gray-700 mb-1">Aucun avis pour le moment</p>
                            <p className="text-sm text-gray-500">Soyez le premier à partager votre expérience !</p>
                        </div>
                    )}
                </div>
            </section>

            {/* ══ CTA COMMISSION ═══════════════════════════════════════ */}
            <section className="py-14 px-4 sm:px-6 bg-white">
                <div className="container mx-auto max-w-6xl"><CtaCommission /></div>
            </section>

            {/* ══ CONTACT ══════════════════════════════════════════════ */}
            <AltimmoContact />

        </div>
    );
};

export default AltimmoPage;