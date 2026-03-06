import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Sparkles, Search, Loader2, Grid3x3, List,
    ChevronLeft, ChevronRight, Star, Calendar,
    Tag, X, SlidersHorizontal, Briefcase, ArrowRight,
} from 'lucide-react';
import { getAllPortfolioItems } from '../services/portfolioService';

// ─────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────
const GOLD        = '#C8872A';
const GOLD_DARK   = '#A06820';
const GOLD_LIGHT  = '#E5A84B';
const BLUE        = '#2E7BB5';

const BACKEND_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'https://altitude-vision.onrender.com';
const ITEMS_PER_PAGE = 12;

const CATEGORIES = [
    'all',
    'Communication Digitale',
    'Branding & Design',
    'Stratégie de Contenu',
    'Campagne Publicitaire',
    'Site Web',
    'Réseaux Sociaux',
];

const getImageUrl = (imagePath) => {
    if (!imagePath) return `https://placehold.co/600x400/${GOLD.replace('#','')}/FFFFFF?text=Altcom`;
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
    if (imagePath.startsWith('/uploads')) return `${BACKEND_URL}${imagePath}`;
    return imagePath;
};

// ─────────────────────────────────────────────────────────────
// Skeleton card
// ─────────────────────────────────────────────────────────────
const CardSkeleton = () => (
    <div className="animate-pulse bg-white rounded-3xl overflow-hidden border border-gray-100">
        <div className="bg-gray-200 h-52" />
        <div className="p-5 space-y-3">
            <div className="h-3 bg-gray-100 rounded-full w-1/3" />
            <div className="h-4 bg-gray-100 rounded-full w-3/4" />
            <div className="h-3 bg-gray-100 rounded-full w-full" />
            <div className="h-3 bg-gray-100 rounded-full w-2/3" />
            <div className="flex justify-between mt-4">
                <div className="h-3 bg-gray-100 rounded-full w-1/4" />
                <div className="h-3 bg-gray-100 rounded-full w-1/4" />
            </div>
        </div>
    </div>
);

// ─────────────────────────────────────────────────────────────
// Card portfolio — vue grille
// ─────────────────────────────────────────────────────────────
const PortfolioCardGrid = ({ item }) => {
    const navigate = useNavigate();
    const imageUrl = getImageUrl(item.images?.[0]);

    return (
        <motion.div
            whileHover={{ y: -5 }}
            onClick={() => navigate(`/altcom/portfolio/${item._id}`)}
            className="group bg-white rounded-3xl border overflow-hidden cursor-pointer transition-all duration-500 hover:shadow-xl"
            style={{ borderColor: 'rgba(0,0,0,0.06)' }}
        >
            {/* Image */}
            <div className="relative h-52 overflow-hidden">
                <img src={imageUrl} alt={item.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    onError={e => { e.target.onerror = null; e.target.src = `https://placehold.co/600x400/C8872A/FFFFFF?text=Altcom`; }} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />

                {/* Rating badge */}
                {item.averageRating > 0 && (
                    <div className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white/90 backdrop-blur-sm shadow-sm">
                        <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                        <span className="text-xs font-bold text-gray-900"
                            style={{ fontFamily: "'Outfit', sans-serif" }}>
                            {item.averageRating.toFixed(1)}
                        </span>
                    </div>
                )}

                {/* Hover line */}
                <div className="absolute bottom-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ backgroundColor: GOLD }} />
            </div>

            {/* Contenu */}
            <div className="p-5">
                {/* Badge catégorie */}
                <span className="inline-block text-xs font-bold px-2.5 py-1 rounded-full mb-3"
                    style={{ backgroundColor: `${GOLD}12`, color: GOLD, fontFamily: "'Outfit', sans-serif" }}>
                    {item.category}
                </span>

                <h3 className="font-bold text-gray-900 mb-2 line-clamp-1 text-lg transition-colors group-hover:text-[#C8872A]"
                    style={{ fontFamily: "'Outfit', sans-serif" }}>
                    {item.title}
                </h3>
                <p className="text-sm text-gray-500 mb-4 line-clamp-2 leading-relaxed"
                    style={{ fontFamily: "'Outfit', sans-serif" }}>
                    {item.description}
                </p>

                <div className="flex items-center justify-between text-xs text-gray-400 pt-3 border-t border-gray-100">
                    {item.client && (
                        <span className="flex items-center gap-1.5"
                            style={{ fontFamily: "'Outfit', sans-serif" }}>
                            <Tag className="w-3.5 h-3.5" style={{ color: GOLD }} />
                            {item.client}
                        </span>
                    )}
                    {item.projectDate && (
                        <span className="flex items-center gap-1.5"
                            style={{ fontFamily: "'Outfit', sans-serif" }}>
                            <Calendar className="w-3.5 h-3.5" style={{ color: BLUE }} />
                            {new Date(item.projectDate).getFullYear()}
                        </span>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

// ─────────────────────────────────────────────────────────────
// Card portfolio — vue liste
// ─────────────────────────────────────────────────────────────
const PortfolioCardList = ({ item }) => {
    const navigate = useNavigate();
    const imageUrl = getImageUrl(item.images?.[0]);

    return (
        <motion.div
            whileHover={{ x: 4 }}
            onClick={() => navigate(`/altcom/portfolio/${item._id}`)}
            className="group bg-white rounded-3xl border overflow-hidden cursor-pointer transition-all duration-400 hover:shadow-lg flex flex-col sm:flex-row"
            style={{ borderColor: 'rgba(0,0,0,0.06)' }}
        >
            {/* Image */}
            <div className="relative sm:w-56 h-44 sm:h-auto flex-shrink-0 overflow-hidden">
                <img src={imageUrl} alt={item.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    onError={e => { e.target.onerror = null; e.target.src = `https://placehold.co/600x400/C8872A/FFFFFF?text=Altcom`; }} />
                <div className="absolute inset-0 bg-gradient-to-t sm:bg-gradient-to-r from-black/30 to-transparent" />
            </div>

            {/* Contenu */}
            <div className="flex-1 p-6 flex flex-col justify-between">
                <div>
                    <div className="flex items-start justify-between mb-3 gap-3">
                        <div>
                            <span className="inline-block text-xs font-bold px-2.5 py-1 rounded-full mb-2"
                                style={{ backgroundColor: `${GOLD}12`, color: GOLD, fontFamily: "'Outfit', sans-serif" }}>
                                {item.category}
                            </span>
                            <h3 className="font-bold text-gray-900 text-xl line-clamp-1 transition-colors group-hover:text-[#C8872A]"
                                style={{ fontFamily: "'Outfit', sans-serif" }}>
                                {item.title}
                            </h3>
                        </div>
                        {item.averageRating > 0 && (
                            <div className="flex items-center gap-1 flex-shrink-0 px-2.5 py-1.5 rounded-full border"
                                style={{ borderColor: `${GOLD}25`, backgroundColor: `${GOLD}08` }}>
                                <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                                <span className="text-xs font-bold" style={{ color: GOLD_DARK, fontFamily: "'Outfit', sans-serif" }}>
                                    {item.averageRating.toFixed(1)}
                                </span>
                            </div>
                        )}
                    </div>
                    <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed"
                        style={{ fontFamily: "'Outfit', sans-serif" }}>
                        {item.description}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400 mt-4 pt-3 border-t border-gray-100">
                    {item.client && (
                        <span className="flex items-center gap-1.5" style={{ fontFamily: "'Outfit', sans-serif" }}>
                            <Tag className="w-3.5 h-3.5" style={{ color: GOLD }} />
                            {item.client}
                        </span>
                    )}
                    {item.projectDate && (
                        <span className="flex items-center gap-1.5" style={{ fontFamily: "'Outfit', sans-serif" }}>
                            <Calendar className="w-3.5 h-3.5" style={{ color: BLUE }} />
                            {new Date(item.projectDate).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' })}
                        </span>
                    )}
                    <span className="ml-auto flex items-center gap-1.5 font-semibold transition-all group-hover:gap-2.5"
                        style={{ color: GOLD, fontFamily: "'Outfit', sans-serif" }}>
                        Voir le projet
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </span>
                </div>
            </div>
        </motion.div>
    );
};

// ─────────────────────────────────────────────────────────────
// Pagination
// ─────────────────────────────────────────────────────────────
const Pagination = ({ currentPage, totalPages, onPageChange }) => {
    if (totalPages <= 1) return null;
    return (
        <div className="flex justify-center items-center gap-2 mt-12">
            <button onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1}
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
            <button onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}
                className="w-9 h-9 rounded-full border border-gray-200 bg-white flex items-center justify-center disabled:opacity-30 hover:bg-gray-50 transition-all">
                <ChevronRight className="w-4 h-4 text-gray-500" />
            </button>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────
// Page principale
// ─────────────────────────────────────────────────────────────
const AltcomAnnonces = () => {
    const navigate     = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const [portfolio,    setPortfolio]   = useState([]);
    const [loading,      setLoading]     = useState(true);
    const [error,        setError]       = useState(null);
    const [viewMode,     setViewMode]    = useState('grid');
    const [currentPage,  setPage]        = useState(1);
    const [showFilters,  setShowFilters] = useState(false);

    const [filters, setFilters] = useState({
        search:   searchParams.get('search')   || '',
        category: searchParams.get('category') || 'all',
        sortBy:   searchParams.get('sortBy')   || 'recent',
    });

    // ── Fetch ────────────────────────────────
    const fetchPortfolio = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getAllPortfolioItems('Altcom');
            setPortfolio(data || []);
        } catch {
            setError('Impossible de charger le portfolio');
            setPortfolio([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchPortfolio(); }, []);

    // ── Sync URL ─────────────────────────────
    useEffect(() => {
        const params = new URLSearchParams();
        if (filters.search)              params.set('search',   filters.search);
        if (filters.category !== 'all')  params.set('category', filters.category);
        if (filters.sortBy   !== 'recent')params.set('sortBy',  filters.sortBy);
        setSearchParams(params);
        setPage(1);
    }, [filters]);

    // ── Filtres + tri ────────────────────────
    const filtered = (() => {
        let f = [...portfolio];
        if (filters.search) {
            const q = filters.search.toLowerCase();
            f = f.filter(i =>
                i.title?.toLowerCase().includes(q) ||
                i.description?.toLowerCase().includes(q) ||
                i.client?.toLowerCase().includes(q) ||
                i.tags?.some(t => t.toLowerCase().includes(q))
            );
        }
        if (filters.category !== 'all') f = f.filter(i => i.category === filters.category);
        switch (filters.sortBy) {
            case 'oldest':  f.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)); break;
            case 'rating':  f.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0)); break;
            case 'title':   f.sort((a, b) => a.title.localeCompare(b.title)); break;
            default:        f.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); break;
        }
        return f;
    })();

    const totalPages      = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    const currentPortfolio = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    const hasFilters      = filters.search || filters.category !== 'all';

    const setFilter = (k, v) => setFilters(f => ({ ...f, [k]: v }));
    const resetFilters   = () => setFilters({ search: '', category: 'all', sortBy: 'recent' });

    const inputFocus = e => { e.target.style.borderColor = GOLD; e.target.style.boxShadow = `0 0 0 3px ${GOLD}15`; };
    const inputBlur  = e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; };

    return (
        <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Outfit', sans-serif" }}>

            {/* ── Hero ─────────────────────────────── */}
            <div className="relative py-20 text-white overflow-hidden"
                style={{
                    backgroundImage: "linear-gradient(to bottom, rgba(100,60,5,0.92), rgba(13,17,23,0.97)), url('https://images.unsplash.com/photo-1557804506-669a67965ba0?q=80&w=1974&auto=format&fit=crop')",
                    backgroundSize: 'cover', backgroundPosition: 'center',
                }}>

                <div className="absolute top-0 left-0 right-0 h-px"
                    style={{ background: `linear-gradient(to right, transparent, ${GOLD}60, transparent)` }} />
                {/* Halo or */}
                <div className="absolute inset-0 pointer-events-none"
                    style={{ background: `radial-gradient(ellipse at 20% 50%, ${GOLD}20, transparent 60%)` }} />

                <div className="container mx-auto px-4 sm:px-6 max-w-6xl relative z-10">
                    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7 }}>
                        <p className="text-xs font-bold uppercase tracking-widest mb-4 text-white/60">
                            Altcom
                        </p>
                        <h1 className="text-white mb-4 max-w-3xl"
                            style={{
                                fontFamily: "'Cormorant Garamond', Georgia, serif",
                                fontSize:   'clamp(2.2rem, 5vw, 4rem)',
                                fontWeight: 700, lineHeight: 1.1,
                            }}>
                            Portfolio & Réalisations
                        </h1>
                        <div className="h-0.5 w-16 rounded-full mb-4"
                            style={{ background: `linear-gradient(to right, ${GOLD}, ${BLUE})` }} />
                        <p className="text-white/60 max-w-xl leading-relaxed mb-8">
                            Découvrez nos projets de communication réalisés avec passion, créativité et expertise.
                        </p>

                        {/* Stats */}
                        <div className="flex flex-wrap gap-3">
                            {[
                                { value: portfolio.length, label: 'Projets' },
                                { value: CATEGORIES.length - 1, label: 'Catégories' },
                            ].map(({ value, label }, i) => (
                                <div key={i}
                                    className="px-5 py-2.5 rounded-full backdrop-blur-sm border border-white/10 text-sm font-semibold"
                                    style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                                    <span style={{ color: GOLD_LIGHT }}>{value}</span>
                                    {' '}{label}
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* ── Contenu ──────────────────────────── */}
            <div className="container mx-auto px-4 sm:px-6 max-w-6xl py-12">

                {/* Barre recherche + filtres */}
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 mb-8">
                    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">

                        {/* Search */}
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input type="text" placeholder="Rechercher par titre, client, tags..."
                                value={filters.search} onChange={e => setFilter('search', e.target.value)}
                                className="w-full pl-11 pr-10 py-3 border border-gray-200 rounded-2xl bg-gray-50 text-sm text-gray-900 focus:outline-none focus:bg-white transition-all placeholder-gray-400"
                                style={{ fontFamily: "'Outfit', sans-serif" }}
                                onFocus={inputFocus} onBlur={inputBlur} />
                            {filters.search && (
                                <button onClick={() => setFilter('search', '')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 transition-colors">
                                    <X className="w-3.5 h-3.5 text-gray-400" />
                                </button>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 flex-shrink-0">
                            <button onClick={() => setShowFilters(!showFilters)}
                                className="flex items-center gap-2 px-4 py-3 rounded-2xl font-semibold text-sm transition-all"
                                style={{
                                    background:  showFilters ? `linear-gradient(135deg, ${GOLD_DARK}, ${GOLD})` : '#F9FAFB',
                                    color:       showFilters ? 'white' : '#374151',
                                    border:      `1px solid ${showFilters ? 'transparent' : '#E5E7EB'}`,
                                    fontFamily:  "'Outfit', sans-serif",
                                }}>
                                <SlidersHorizontal className="w-4 h-4" />
                                Filtres
                            </button>

                            <div className="flex bg-gray-100 rounded-2xl p-1 gap-1">
                                {[{ mode: 'grid', Icon: Grid3x3 }, { mode: 'list', Icon: List }].map(({ mode, Icon }) => (
                                    <button key={mode} onClick={() => setViewMode(mode)}
                                        className="p-2 rounded-xl transition-all"
                                        style={{
                                            background: viewMode === mode ? 'white' : 'transparent',
                                            boxShadow:  viewMode === mode ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                                        }}>
                                        <Icon className="w-4 h-4 text-gray-600" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Panneau filtres */}
                    <AnimatePresence>
                        {showFilters && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }}
                                className="overflow-hidden">
                                <div className="pt-5 mt-5 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-6">

                                    {/* Catégories */}
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-3"
                                            style={{ fontFamily: "'Outfit', sans-serif" }}>
                                            Catégorie
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {CATEGORIES.map(cat => (
                                                <button key={cat} onClick={() => setFilter('category', cat)}
                                                    className="px-3.5 py-2 rounded-full text-xs font-semibold transition-all"
                                                    style={{
                                                        background:  filters.category === cat ? `linear-gradient(135deg, ${GOLD_DARK}, ${GOLD})` : '#F9FAFB',
                                                        color:       filters.category === cat ? 'white' : '#6B7280',
                                                        border:      `1px solid ${filters.category === cat ? 'transparent' : '#E5E7EB'}`,
                                                        boxShadow:   filters.category === cat ? `0 4px 12px ${GOLD}30` : 'none',
                                                        fontFamily:  "'Outfit', sans-serif",
                                                    }}>
                                                    {cat === 'all' ? 'Toutes' : cat}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Tri */}
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-3"
                                            style={{ fontFamily: "'Outfit', sans-serif" }}>
                                            Trier par
                                        </label>
                                        <select value={filters.sortBy} onChange={e => setFilter('sortBy', e.target.value)}
                                            className="w-full px-4 py-3 border border-gray-200 rounded-2xl bg-gray-50 text-sm text-gray-900 focus:outline-none transition-all"
                                            style={{ fontFamily: "'Outfit', sans-serif" }}
                                            onFocus={inputFocus} onBlur={inputBlur}>
                                            <option value="recent">Plus récent</option>
                                            <option value="oldest">Plus ancien</option>
                                            <option value="rating">Mieux notés</option>
                                            <option value="title">Titre (A–Z)</option>
                                        </select>
                                    </div>
                                </div>

                                {hasFilters && (
                                    <div className="flex justify-end mt-4">
                                        <button onClick={resetFilters}
                                            className="flex items-center gap-1.5 text-sm font-semibold text-gray-400 hover:text-gray-700 transition-colors"
                                            style={{ fontFamily: "'Outfit', sans-serif" }}>
                                            <X className="w-4 h-4" />
                                            Réinitialiser
                                        </button>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Compteur */}
                <div className="flex items-center justify-between mb-6 px-1">
                    <p className="text-sm text-gray-500" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        <span className="font-bold text-gray-900">{filtered.length}</span>{' '}
                        projet{filtered.length > 1 ? 's' : ''} trouvé{filtered.length > 1 ? 's' : ''}
                    </p>
                    {hasFilters && (
                        <button onClick={resetFilters}
                            className="text-sm font-semibold transition-colors hover:opacity-80"
                            style={{ color: GOLD, fontFamily: "'Outfit', sans-serif" }}>
                            Voir tous les projets
                        </button>
                    )}
                </div>

                {/* Erreur */}
                {error && (
                    <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl mb-8">
                        <span>⚠️</span>
                        <p className="text-red-700 text-sm font-medium">{error}</p>
                        <button onClick={fetchPortfolio}
                            className="ml-auto text-sm font-semibold px-4 py-1.5 rounded-full text-white"
                            style={{ background: `linear-gradient(135deg, ${GOLD_DARK}, ${GOLD})`, fontFamily: "'Outfit', sans-serif" }}>
                            Réessayer
                        </button>
                    </div>
                )}

                {/* Contenu */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {[1,2,3,4,5,6].map(i => <CardSkeleton key={i} />)}
                    </div>
                ) : currentPortfolio.length === 0 ? (
                    <div className="text-center py-20 rounded-3xl border border-dashed"
                        style={{ borderColor: `${GOLD}25`, backgroundColor: `${GOLD}03` }}>
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                            style={{ background: `linear-gradient(135deg, ${GOLD_DARK}, ${GOLD})` }}>
                            <Briefcase className="w-8 h-8 text-white" />
                        </div>
                        <h3 className="font-bold text-gray-800 text-xl mb-2"
                            style={{ fontFamily: "'Outfit', sans-serif" }}>
                            Aucun projet trouvé
                        </h3>
                        <p className="text-gray-500 text-sm mb-6"
                            style={{ fontFamily: "'Outfit', sans-serif" }}>
                            Essayez de modifier vos critères de recherche
                        </p>
                        {hasFilters && (
                            <button onClick={resetFilters}
                                className="px-6 py-2.5 rounded-full font-semibold text-white text-sm"
                                style={{ background: `linear-gradient(135deg, ${GOLD_DARK}, ${GOLD})`, fontFamily: "'Outfit', sans-serif" }}>
                                Réinitialiser les filtres
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={`${viewMode}-${currentPage}`}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.3 }}
                                className={viewMode === 'grid'
                                    ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5'
                                    : 'flex flex-col gap-4'}
                            >
                                {currentPortfolio.map(item =>
                                    viewMode === 'grid'
                                        ? <PortfolioCardGrid key={item._id} item={item} />
                                        : <PortfolioCardList key={item._id} item={item} />
                                )}
                            </motion.div>
                        </AnimatePresence>
                        <Pagination currentPage={currentPage} totalPages={totalPages}
                            onPageChange={p => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
                    </>
                )}
            </div>
        </div>
    );
};

export default AltcomAnnonces;