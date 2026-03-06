import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Home, MapPin, Search, X, AlertCircle,
    ChevronLeft, ChevronRight, Grid3x3, List,
    SlidersHorizontal, Building2, Tag, ArrowRight,
} from 'lucide-react';
import { getAllProperties } from '../services/propertyService';
import PropertyCard         from '../components/PropertyCard';

// ─────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────
const BLUE       = '#2E7BB5';
const BLUE_DARK  = '#1A5A8A';
const GOLD       = '#C8872A';

const PROPERTIES_PER_PAGE  = 12;
const TRANSACTION_TYPES    = ['Tous', 'vente', 'location', 'viager'];
const PROPERTY_TYPES       = ['Tous', 'Appartement', 'Maison', 'Villa', 'Terrain', 'Bureau', 'Commerce'];
const AVAILABILITY_STATUS  = ['Tous', 'Disponible', 'Vendu', 'Loué', 'Réservé'];

// ─────────────────────────────────────────────────────────────
// Skeleton card
// ─────────────────────────────────────────────────────────────
const PropertySkeleton = () => (
    <div className="animate-pulse bg-white rounded-3xl overflow-hidden border border-gray-100">
        <div className="bg-gray-200 h-52" />
        <div className="p-5 space-y-3">
            <div className="flex gap-2">
                <div className="h-5 bg-gray-100 rounded-full w-16" />
                <div className="h-5 bg-gray-100 rounded-full w-20" />
            </div>
            <div className="h-4 bg-gray-100 rounded-full w-3/4" />
            <div className="h-3 bg-gray-100 rounded-full w-full" />
            <div className="h-5 bg-gray-100 rounded-full w-1/3 mt-2" />
        </div>
    </div>
);

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
                        background:  p === currentPage ? `linear-gradient(135deg, ${BLUE_DARK}, ${BLUE})` : 'white',
                        color:       p === currentPage ? 'white' : '#6B7280',
                        border:      `1px solid ${p === currentPage ? 'transparent' : '#E5E7EB'}`,
                        boxShadow:   p === currentPage ? `0 4px 12px ${BLUE}40` : 'none',
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
// Page principale
// ─────────────────────────────────────────────────────────────
const AltimmoAnnonces = () => {
    const [properties,   setProperties]  = useState([]);
    const [filtered,     setFiltered]    = useState([]);
    const [loading,      setLoading]     = useState(true);
    const [error,        setError]       = useState(null);
    const [currentPage,  setPage]        = useState(1);
    const [searchTerm,   setSearch]      = useState('');
    const [selStatus,    setSelStatus]   = useState('Tous');
    const [selType,      setSelType]     = useState('Tous');
    const [selAvail,     setSelAvail]    = useState('Tous');
    const [showFilters,  setShowFilters] = useState(false);
    const [viewMode,     setViewMode]    = useState('grid');
    const [sortBy,       setSortBy]      = useState('date-desc');
    const [priceRange,   setPriceRange]  = useState({ min: '', max: '' });

    // ── Fetch ─────────────────────────────────
    const fetchProperties = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getAllProperties({ pole: 'Altimmo' });
            setProperties(data || []);
            setFiltered(data || []);
        } catch {
            setError('Impossible de charger les annonces. Veuillez réessayer.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchProperties(); }, []);

    // ── Filtres ───────────────────────────────
    useEffect(() => {
        let f = [...properties];

        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            f = f.filter(p => [
                p.title || '', p.description || '',
                p.address?.city || '', p.address?.district || '',
                p.address?.street || '', p.type || '',
            ].join(' ').toLowerCase().includes(q));
        }
        if (selStatus !== 'Tous') f = f.filter(p => p.status === selStatus);
        if (selType   !== 'Tous') f = f.filter(p => p.type === selType);
        if (selAvail  !== 'Tous') f = f.filter(p => p.availability === selAvail);
        if (priceRange.min && !isNaN(priceRange.min)) f = f.filter(p => p.price >= parseInt(priceRange.min));
        if (priceRange.max && !isNaN(priceRange.max)) f = f.filter(p => p.price <= parseInt(priceRange.max));

        switch (sortBy) {
            case 'date-asc':     f.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)); break;
            case 'price-asc':    f.sort((a, b) => (a.price || 0) - (b.price || 0)); break;
            case 'price-desc':   f.sort((a, b) => (b.price || 0) - (a.price || 0)); break;
            case 'surface-desc': f.sort((a, b) => (b.surface || 0) - (a.surface || 0)); break;
            case 'surface-asc':  f.sort((a, b) => (a.surface || 0) - (b.surface || 0)); break;
            default:             f.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); break;
        }

        setFiltered(f);
        setPage(1);
    }, [properties, searchTerm, selStatus, selType, selAvail, sortBy, priceRange]);

    const resetFilters = () => {
        setSearch(''); setSelStatus('Tous'); setSelType('Tous');
        setSelAvail('Tous'); setSortBy('date-desc'); setPriceRange({ min: '', max: '' });
    };

    const hasFilters = searchTerm.trim() || selStatus !== 'Tous' || selType !== 'Tous' ||
        selAvail !== 'Tous' || priceRange.min || priceRange.max;

    const totalPages        = Math.ceil(filtered.length / PROPERTIES_PER_PAGE);
    const currentProperties = filtered.slice((currentPage - 1) * PROPERTIES_PER_PAGE, currentPage * PROPERTIES_PER_PAGE);

    const inputFocus = e => { e.target.style.borderColor = BLUE; e.target.style.boxShadow = `0 0 0 3px ${BLUE}15`; };
    const inputBlur  = e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; };

    // ── État erreur ───────────────────────────
    if (error) return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
            <div className="bg-white rounded-3xl border border-red-100 p-8 max-w-md w-full text-center shadow-sm">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{ background: `${BLUE}12` }}>
                    <AlertCircle className="w-7 h-7" style={{ color: BLUE }} />
                </div>
                <h3 className="font-bold text-gray-900 text-lg mb-2"
                    style={{ fontFamily: "'Outfit', sans-serif" }}>
                    Erreur de chargement
                </h3>
                <p className="text-gray-500 text-sm mb-6"
                    style={{ fontFamily: "'Outfit', sans-serif" }}>
                    {error}
                </p>
                <button onClick={fetchProperties}
                    className="px-6 py-2.5 rounded-full font-semibold text-white text-sm"
                    style={{ background: `linear-gradient(135deg, ${BLUE_DARK}, ${BLUE})`, fontFamily: "'Outfit', sans-serif" }}>
                    Réessayer
                </button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Outfit', sans-serif" }}>

            {/* ── Hero ─────────────────────────────── */}
            <div className="relative py-20 text-white overflow-hidden"
                style={{
                    backgroundImage: "linear-gradient(to bottom, rgba(26,90,138,0.92), rgba(13,17,23,0.97)), url('https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=2073&auto=format&fit=crop')",
                    backgroundSize: 'cover', backgroundPosition: 'center',
                }}>

                <div className="absolute top-0 left-0 right-0 h-px"
                    style={{ background: `linear-gradient(to right, transparent, ${BLUE}60, transparent)` }} />
                <div className="absolute inset-0 pointer-events-none"
                    style={{ background: `radial-gradient(ellipse at 20% 50%, ${BLUE}20, transparent 60%)` }} />

                <div className="container mx-auto px-4 sm:px-6 max-w-6xl relative z-10">
                    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7 }}>

                        <p className="text-xs font-bold uppercase tracking-widest mb-4 text-white/60">
                            Altimmo
                        </p>
                        <h1 className="text-white mb-4 max-w-3xl"
                            style={{
                                fontFamily: "'Cormorant Garamond', Georgia, serif",
                                fontSize:   'clamp(2.2rem, 5vw, 4rem)',
                                fontWeight: 700, lineHeight: 1.1,
                            }}>
                            Nos Biens Immobiliers
                        </h1>
                        <div className="h-0.5 w-16 rounded-full mb-4"
                            style={{ background: `linear-gradient(to right, ${BLUE}, ${GOLD})` }} />
                        <p className="text-white/60 max-w-xl leading-relaxed mb-8">
                            Découvrez notre sélection de propriétés exceptionnelles pour votre projet immobilier.
                        </p>

                        {/* Stats */}
                        <div className="flex flex-wrap gap-3">
                            {[
                                { Icon: Building2, value: properties.length, label: 'Biens' },
                                { Icon: Tag,       value: PROPERTY_TYPES.length - 1, label: 'Types' },
                            ].map(({ Icon, value, label }, i) => (
                                <div key={i}
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-full backdrop-blur-sm border border-white/10 text-sm font-semibold"
                                    style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                                    <Icon className="w-4 h-4" style={{ color: '#90C8F0' }} />
                                    <span style={{ color: '#90C8F0' }}>{value}</span>
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
                            <input type="text" placeholder="Rechercher un bien, une ville, un quartier..."
                                value={searchTerm} onChange={e => setSearch(e.target.value)}
                                className="w-full pl-11 pr-10 py-3 border border-gray-200 rounded-2xl bg-gray-50 text-sm text-gray-900 focus:outline-none focus:bg-white transition-all placeholder-gray-400"
                                style={{ fontFamily: "'Outfit', sans-serif" }}
                                onFocus={inputFocus} onBlur={inputBlur} />
                            {searchTerm && (
                                <button onClick={() => setSearch('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 transition-colors">
                                    <X className="w-3.5 h-3.5 text-gray-400" />
                                </button>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 flex-shrink-0">
                            <button onClick={() => setShowFilters(!showFilters)}
                                className="flex items-center gap-2 px-4 py-3 rounded-2xl font-semibold text-sm transition-all relative"
                                style={{
                                    background:  (showFilters || hasFilters) ? `linear-gradient(135deg, ${BLUE_DARK}, ${BLUE})` : '#F9FAFB',
                                    color:       (showFilters || hasFilters) ? 'white' : '#374151',
                                    border:      `1px solid ${(showFilters || hasFilters) ? 'transparent' : '#E5E7EB'}`,
                                    fontFamily:  "'Outfit', sans-serif",
                                }}>
                                <SlidersHorizontal className="w-4 h-4" />
                                Filtres
                                {hasFilters && !showFilters && (
                                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-xs font-bold flex items-center justify-center text-white"
                                        style={{ background: GOLD, fontSize: '9px' }}>
                                        !
                                    </span>
                                )}
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
                                <div className="pt-5 mt-5 border-t border-gray-100">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                                        {/* Transaction */}
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-3"
                                                style={{ fontFamily: "'Outfit', sans-serif" }}>
                                                Type de transaction
                                            </label>
                                            <div className="flex flex-wrap gap-2">
                                                {TRANSACTION_TYPES.map(s => (
                                                    <button key={s} onClick={() => setSelStatus(s)}
                                                        className="px-3.5 py-2 rounded-full text-xs font-semibold capitalize transition-all"
                                                        style={{
                                                            background:  selStatus === s ? `linear-gradient(135deg, ${BLUE_DARK}, ${BLUE})` : '#F9FAFB',
                                                            color:       selStatus === s ? 'white' : '#6B7280',
                                                            border:      `1px solid ${selStatus === s ? 'transparent' : '#E5E7EB'}`,
                                                            boxShadow:   selStatus === s ? `0 4px 12px ${BLUE}30` : 'none',
                                                            fontFamily:  "'Outfit', sans-serif",
                                                        }}>
                                                        {s}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Type de bien */}
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-3"
                                                style={{ fontFamily: "'Outfit', sans-serif" }}>
                                                Type de bien
                                            </label>
                                            <select value={selType} onChange={e => setSelType(e.target.value)}
                                                className="w-full px-4 py-3 border border-gray-200 rounded-2xl bg-gray-50 text-sm text-gray-900 focus:outline-none transition-all"
                                                style={{ fontFamily: "'Outfit', sans-serif" }}
                                                onFocus={inputFocus} onBlur={inputBlur}>
                                                {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                        </div>

                                        {/* Disponibilité */}
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-3"
                                                style={{ fontFamily: "'Outfit', sans-serif" }}>
                                                Disponibilité
                                            </label>
                                            <select value={selAvail} onChange={e => setSelAvail(e.target.value)}
                                                className="w-full px-4 py-3 border border-gray-200 rounded-2xl bg-gray-50 text-sm text-gray-900 focus:outline-none transition-all"
                                                style={{ fontFamily: "'Outfit', sans-serif" }}
                                                onFocus={inputFocus} onBlur={inputBlur}>
                                                {AVAILABILITY_STATUS.map(a => <option key={a} value={a}>{a}</option>)}
                                            </select>
                                        </div>

                                        {/* Tri */}
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-3"
                                                style={{ fontFamily: "'Outfit', sans-serif" }}>
                                                Trier par
                                            </label>
                                            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                                                className="w-full px-4 py-3 border border-gray-200 rounded-2xl bg-gray-50 text-sm text-gray-900 focus:outline-none transition-all"
                                                style={{ fontFamily: "'Outfit', sans-serif" }}
                                                onFocus={inputFocus} onBlur={inputBlur}>
                                                <option value="date-desc">Plus récent</option>
                                                <option value="date-asc">Plus ancien</option>
                                                <option value="price-asc">Prix croissant</option>
                                                <option value="price-desc">Prix décroissant</option>
                                                <option value="surface-desc">Surface décroissante</option>
                                                <option value="surface-asc">Surface croissante</option>
                                            </select>
                                        </div>

                                        {/* Prix */}
                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-3"
                                                style={{ fontFamily: "'Outfit', sans-serif" }}>
                                                Fourchette de prix (FCFA)
                                            </label>
                                            <div className="flex gap-3 items-center">
                                                <input type="number" placeholder="Prix min"
                                                    value={priceRange.min}
                                                    onChange={e => setPriceRange(p => ({ ...p, min: e.target.value }))}
                                                    className="flex-1 px-4 py-3 border border-gray-200 rounded-2xl bg-gray-50 text-sm focus:outline-none transition-all"
                                                    style={{ fontFamily: "'Outfit', sans-serif" }}
                                                    onFocus={inputFocus} onBlur={inputBlur} />
                                                <span className="text-gray-400 font-bold">—</span>
                                                <input type="number" placeholder="Prix max"
                                                    value={priceRange.max}
                                                    onChange={e => setPriceRange(p => ({ ...p, max: e.target.value }))}
                                                    className="flex-1 px-4 py-3 border border-gray-200 rounded-2xl bg-gray-50 text-sm focus:outline-none transition-all"
                                                    style={{ fontFamily: "'Outfit', sans-serif" }}
                                                    onFocus={inputFocus} onBlur={inputBlur} />
                                            </div>
                                        </div>
                                    </div>

                                    {hasFilters && (
                                        <div className="flex justify-end mt-5">
                                            <button onClick={resetFilters}
                                                className="flex items-center gap-1.5 text-sm font-semibold text-gray-400 hover:text-gray-700 transition-colors"
                                                style={{ fontFamily: "'Outfit', sans-serif" }}>
                                                <X className="w-4 h-4" />
                                                Réinitialiser
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Compteur résultats */}
                <div className="flex items-center justify-between mb-6 px-1">
                    <p className="text-sm text-gray-500" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        <span className="font-bold text-gray-900">{filtered.length}</span>{' '}
                        bien{filtered.length > 1 ? 's' : ''} trouvé{filtered.length > 1 ? 's' : ''}
                    </p>
                    {hasFilters && (
                        <button onClick={resetFilters}
                            className="flex items-center gap-1.5 text-sm font-semibold transition-colors hover:opacity-80"
                            style={{ color: BLUE, fontFamily: "'Outfit', sans-serif" }}>
                            <X className="w-3.5 h-3.5" />
                            Voir tous les biens
                        </button>
                    )}
                </div>

                {/* Grille / Liste */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {[1,2,3,4,5,6].map(i => <PropertySkeleton key={i} />)}
                    </div>
                ) : currentProperties.length === 0 ? (
                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                        className="text-center py-20 rounded-3xl border border-dashed"
                        style={{ borderColor: `${BLUE}25`, backgroundColor: `${BLUE}03` }}>
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                            style={{ background: `linear-gradient(135deg, ${BLUE_DARK}, ${BLUE})` }}>
                            <Home className="w-8 h-8 text-white" />
                        </div>
                        <h3 className="font-bold text-gray-800 text-xl mb-2"
                            style={{ fontFamily: "'Outfit', sans-serif" }}>
                            Aucun bien trouvé
                        </h3>
                        <p className="text-gray-500 text-sm mb-6"
                            style={{ fontFamily: "'Outfit', sans-serif" }}>
                            {hasFilters ? 'Essayez de modifier vos critères de recherche' : 'Aucun bien disponible pour le moment'}
                        </p>
                        {hasFilters && (
                            <button onClick={resetFilters}
                                className="px-6 py-2.5 rounded-full font-semibold text-white text-sm"
                                style={{ background: `linear-gradient(135deg, ${BLUE_DARK}, ${BLUE})`, fontFamily: "'Outfit', sans-serif" }}>
                                Réinitialiser les filtres
                            </button>
                        )}
                    </motion.div>
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
                                {currentProperties.map((property, i) => (
                                    <motion.div key={property._id}
                                        initial={{ opacity: 0, y: 16 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.3, delay: i * 0.04 }}>
                                        <PropertyCard property={property} index={i} viewMode={viewMode} />
                                    </motion.div>
                                ))}
                            </motion.div>
                        </AnimatePresence>
                        <Pagination totalPages={totalPages} currentPage={currentPage}
                            onPageChange={p => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
                    </>
                )}
            </div>
        </div>
    );
};

export default AltimmoAnnonces;