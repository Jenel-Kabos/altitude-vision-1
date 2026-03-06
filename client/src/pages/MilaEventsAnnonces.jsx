import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Calendar, MapPin, Search, X, AlertCircle,
    ChevronLeft, ChevronRight, Users, Video,
    Grid3x3, List, SlidersHorizontal, PartyPopper,
} from 'lucide-react';
import { getAllEvents }       from '../services/eventService';
import { getFirstValidImage } from '../utils/imageUtils';

// ─────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────
const MILA_RED      = '#D42B2B';
const MILA_RED_DARK = '#A01E1E';
const MILA_GOLD     = '#C8872A';

const EVENTS_PER_PAGE = 12;

const CATEGORIES = ['Tous', 'Événement', 'Mariage', 'Gala', 'Conférence', 'Anniversaire', 'Lancement'];

// ─────────────────────────────────────────────────────────────
// Skeleton card
// ─────────────────────────────────────────────────────────────
const CardSkeleton = () => (
    <div className="animate-pulse bg-white rounded-3xl overflow-hidden border border-gray-100">
        <div className="bg-gray-200 h-52" />
        <div className="p-5 space-y-3">
            <div className="h-4 bg-gray-100 rounded-full w-3/4" />
            <div className="h-3 bg-gray-100 rounded-full w-full" />
            <div className="h-3 bg-gray-100 rounded-full w-2/3" />
            <div className="flex gap-4 mt-4">
                <div className="h-3 bg-gray-100 rounded-full w-1/3" />
                <div className="h-3 bg-gray-100 rounded-full w-1/3" />
            </div>
        </div>
    </div>
);

// ─────────────────────────────────────────────────────────────
// Card événement — vue grille
// ─────────────────────────────────────────────────────────────
const EventCardGrid = ({ event, index }) => {
    const navigate = useNavigate();
    const img = getFirstValidImage(event.images, 'https://placehold.co/600x400/D42B2B/FFFFFF?text=Mila+Events');
    const date = event.date ? new Date(event.date).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Date non définie';

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.04 }}
            whileHover={{ y: -5 }}
            onClick={() => navigate(`/mila-events/event/${event._id}`)}
            className="group bg-white rounded-3xl border overflow-hidden cursor-pointer transition-all duration-500 hover:shadow-xl"
            style={{ borderColor: 'rgba(0,0,0,0.06)' }}
        >
            {/* Image */}
            <div className="relative h-52 overflow-hidden">
                <img src={img} alt={event.name || event.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    onError={e => { e.target.src = 'https://placehold.co/600x400/D42B2B/FFFFFF?text=Mila+Events'; }} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

                {/* Badges */}
                <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
                    <span className="text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg"
                        style={{ background: `linear-gradient(135deg, ${MILA_RED_DARK}, ${MILA_RED})`, fontFamily: "'Outfit', sans-serif" }}>
                        {event.category || 'Événement'}
                    </span>
                    {event.videos?.length > 0 && (
                        <span className="bg-black/40 backdrop-blur-sm text-white text-xs font-bold px-2.5 py-1.5 rounded-full flex items-center gap-1 border border-white/20">
                            <Video className="w-3 h-3" />
                            {event.videos.length}
                        </span>
                    )}
                </div>
                {event.guests && (
                    <span className="absolute bottom-3 right-3 bg-white/15 backdrop-blur-sm text-white text-xs font-semibold px-2.5 py-1.5 rounded-full flex items-center gap-1.5 border border-white/20">
                        <Users className="w-3 h-3" />
                        {event.guests}
                    </span>
                )}
                {/* Hover line */}
                <div className="absolute bottom-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ backgroundColor: MILA_RED }} />
            </div>

            {/* Contenu */}
            <div className="p-5">
                <h3 className="font-bold text-gray-900 mb-2 line-clamp-1 text-lg transition-colors group-hover:text-[#D42B2B]"
                    style={{ fontFamily: "'Outfit', sans-serif" }}>
                    {event.name || event.title}
                </h3>
                <p className="text-sm text-gray-500 mb-4 line-clamp-2 leading-relaxed"
                    style={{ fontFamily: "'Outfit', sans-serif" }}>
                    {event.description}
                </p>
                <div className="space-y-1.5 text-xs text-gray-400">
                    <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 flex-shrink-0" style={{ color: MILA_RED }} />
                        <span style={{ fontFamily: "'Outfit', sans-serif" }}>{date}</span>
                    </div>
                    {event.location && (
                        <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: MILA_GOLD }} />
                            <span className="line-clamp-1" style={{ fontFamily: "'Outfit', sans-serif" }}>{event.location}</span>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

// ─────────────────────────────────────────────────────────────
// Card événement — vue liste
// ─────────────────────────────────────────────────────────────
const EventCardList = ({ event, index }) => {
    const navigate = useNavigate();
    const img = getFirstValidImage(event.images, 'https://placehold.co/600x400/D42B2B/FFFFFF?text=Mila+Events');
    const date = event.date ? new Date(event.date).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Date non définie';

    return (
        <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: index * 0.04 }}
            onClick={() => navigate(`/mila-events/event/${event._id}`)}
            className="group bg-white rounded-3xl border overflow-hidden cursor-pointer transition-all duration-400 hover:shadow-lg flex flex-col sm:flex-row"
            style={{ borderColor: 'rgba(0,0,0,0.06)' }}
        >
            {/* Image */}
            <div className="relative sm:w-56 h-48 sm:h-auto flex-shrink-0 overflow-hidden">
                <img src={img} alt={event.name || event.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t sm:bg-gradient-to-r from-black/40 to-transparent" />
                <span className="absolute top-3 left-3 text-white text-xs font-bold px-3 py-1.5 rounded-full"
                    style={{ background: `linear-gradient(135deg, ${MILA_RED_DARK}, ${MILA_RED})`, fontFamily: "'Outfit', sans-serif" }}>
                    {event.category || 'Événement'}
                </span>
            </div>

            {/* Contenu */}
            <div className="flex-1 p-5 flex flex-col justify-between">
                <div>
                    <h3 className="font-bold text-gray-900 text-xl mb-2 line-clamp-1 transition-colors group-hover:text-[#D42B2B]"
                        style={{ fontFamily: "'Outfit', sans-serif" }}>
                        {event.name || event.title}
                    </h3>
                    <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed mb-4"
                        style={{ fontFamily: "'Outfit', sans-serif" }}>
                        {event.description}
                    </p>
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-gray-400">
                    <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" style={{ color: MILA_RED }} />
                        <span style={{ fontFamily: "'Outfit', sans-serif" }}>{date}</span>
                    </div>
                    {event.location && (
                        <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5" style={{ color: MILA_GOLD }} />
                            <span style={{ fontFamily: "'Outfit', sans-serif" }}>{event.location}</span>
                        </div>
                    )}
                    {event.guests && (
                        <div className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5" style={{ color: MILA_RED }} />
                            <span style={{ fontFamily: "'Outfit', sans-serif" }}>{event.guests} invités</span>
                        </div>
                    )}
                </div>
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
                        background:  p === currentPage ? `linear-gradient(135deg, ${MILA_RED_DARK}, ${MILA_RED})` : 'white',
                        color:       p === currentPage ? 'white' : '#6B7280',
                        border:      `1px solid ${p === currentPage ? 'transparent' : '#E5E7EB'}`,
                        boxShadow:   p === currentPage ? `0 4px 12px ${MILA_RED}40` : 'none',
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
const MilaEventsAnnonces = () => {
    const [events,          setEvents]          = useState([]);
    const [filteredEvents,  setFiltered]         = useState([]);
    const [loading,         setLoading]          = useState(true);
    const [error,           setError]            = useState(null);
    const [currentPage,     setCurrentPage]      = useState(1);
    const [searchTerm,      setSearchTerm]       = useState('');
    const [selectedCat,     setSelectedCat]      = useState('Tous');
    const [showFilters,     setShowFilters]      = useState(false);
    const [viewMode,        setViewMode]         = useState('grid');
    const [sortBy,          setSortBy]           = useState('date-desc');

    const fetchEvents = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getAllEvents();
            setEvents(data);
            setFiltered(data);
        } catch {
            setError('Impossible de charger les événements');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchEvents(); }, []);

    useEffect(() => {
        let f = [...events];
        if (searchTerm) f = f.filter(e =>
            e.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            e.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            e.location?.toLowerCase().includes(searchTerm.toLowerCase())
        );
        if (selectedCat !== 'Tous') f = f.filter(e => e.category === selectedCat);
        switch (sortBy) {
            case 'date-desc': f.sort((a, b) => new Date(b.date) - new Date(a.date)); break;
            case 'date-asc':  f.sort((a, b) => new Date(a.date) - new Date(b.date)); break;
            case 'name-asc':  f.sort((a, b) => a.name.localeCompare(b.name));         break;
            case 'name-desc': f.sort((a, b) => b.name.localeCompare(a.name));         break;
        }
        setFiltered(f);
        setCurrentPage(1);
    }, [events, searchTerm, selectedCat, sortBy]);

    const resetFilters = () => { setSearchTerm(''); setSelectedCat('Tous'); setSortBy('date-desc'); };

    const totalPages    = Math.ceil(filteredEvents.length / EVENTS_PER_PAGE);
    const currentEvents = filteredEvents.slice((currentPage - 1) * EVENTS_PER_PAGE, currentPage * EVENTS_PER_PAGE);
    const hasFilters    = searchTerm || selectedCat !== 'Tous';

    // ── État erreur ──────────────────────────
    if (error) return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
            <div className="bg-white rounded-3xl border border-red-100 p-8 max-w-md w-full text-center shadow-sm">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{ background: `${MILA_RED}12` }}>
                    <AlertCircle className="w-7 h-7" style={{ color: MILA_RED }} />
                </div>
                <h3 className="font-bold text-gray-900 text-lg mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
                    Erreur de chargement
                </h3>
                <p className="text-gray-500 text-sm mb-6" style={{ fontFamily: "'Outfit', sans-serif" }}>{error}</p>
                <button onClick={fetchEvents}
                    className="px-6 py-2.5 rounded-full font-semibold text-white text-sm"
                    style={{ background: `linear-gradient(135deg, ${MILA_RED_DARK}, ${MILA_RED})`, fontFamily: "'Outfit', sans-serif" }}>
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
                    backgroundImage: "linear-gradient(to bottom, rgba(160,30,30,0.92), rgba(13,17,23,0.97)), url('https://images.unsplash.com/photo-1540555700478-4be29ab4cb3d?q=80&w=2070&auto=format&fit=crop')",
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                }}>

                {/* Décoration */}
                <div className="absolute top-0 left-0 right-0 h-px"
                    style={{ background: `linear-gradient(to right, transparent, ${MILA_RED}60, transparent)` }} />

                <div className="container mx-auto px-4 sm:px-6 max-w-6xl relative z-10">
                    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7 }}>

                        <p className="text-xs font-bold uppercase tracking-widest mb-4 text-white/60">
                            Mila Events
                        </p>
                        <h1 className="text-white mb-4 max-w-3xl"
                            style={{
                                fontFamily: "'Cormorant Garamond', Georgia, serif",
                                fontSize:   'clamp(2.2rem, 5vw, 4rem)',
                                fontWeight: 700,
                                lineHeight: 1.1,
                            }}>
                            Nos Événements Inoubliables
                        </h1>
                        <div className="h-0.5 w-16 rounded-full mb-4"
                            style={{ background: `linear-gradient(to right, ${MILA_RED}, ${MILA_GOLD})` }} />
                        <p className="text-white/60 max-w-xl text-base leading-relaxed mb-8">
                            Découvrez notre portfolio d'événements exceptionnels réalisés avec passion et expertise.
                        </p>

                        {/* Stats */}
                        <div className="flex flex-wrap gap-3">
                            {[
                                { value: events.length,          label: 'Événements' },
                                { value: CATEGORIES.length - 1,  label: 'Catégories' },
                            ].map(({ value, label }, i) => (
                                <div key={i}
                                    className="px-5 py-2.5 rounded-full backdrop-blur-sm border border-white/10 text-sm font-semibold"
                                    style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                                    <span style={{ color: MILA_RED === '#D42B2B' ? '#F08080' : MILA_RED }}>
                                        {value}
                                    </span>
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

                        {/* Input recherche */}
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input type="text" placeholder="Rechercher un événement, lieu..."
                                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-2xl bg-gray-50 text-sm text-gray-900 focus:outline-none focus:bg-white transition-all placeholder-gray-400"
                                style={{ fontFamily: "'Outfit', sans-serif" }}
                                onFocus={e => { e.target.style.borderColor = MILA_RED; e.target.style.boxShadow = `0 0 0 3px ${MILA_RED}12`; }}
                                onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
                            />
                            {searchTerm && (
                                <button onClick={() => setSearchTerm('')}
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
                                    background:  showFilters ? `linear-gradient(135deg, ${MILA_RED_DARK}, ${MILA_RED})` : '#F9FAFB',
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
                                        }}
                                        title={`Vue ${mode}`}>
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
                                className="overflow-hidden"
                            >
                                <div className="pt-5 mt-5 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-6">

                                    {/* Catégories */}
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-3"
                                            style={{ fontFamily: "'Outfit', sans-serif" }}>
                                            Catégorie
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {CATEGORIES.map(cat => (
                                                <button key={cat} onClick={() => setSelectedCat(cat)}
                                                    className="px-3.5 py-2 rounded-full text-xs font-semibold transition-all"
                                                    style={{
                                                        background:  selectedCat === cat ? `linear-gradient(135deg, ${MILA_RED_DARK}, ${MILA_RED})` : '#F9FAFB',
                                                        color:       selectedCat === cat ? 'white' : '#6B7280',
                                                        border:      `1px solid ${selectedCat === cat ? 'transparent' : '#E5E7EB'}`,
                                                        boxShadow:   selectedCat === cat ? `0 4px 12px ${MILA_RED}30` : 'none',
                                                        fontFamily:  "'Outfit', sans-serif",
                                                    }}>
                                                    {cat}
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
                                        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                                            className="w-full px-4 py-3 border border-gray-200 rounded-2xl bg-gray-50 text-sm text-gray-900 focus:outline-none transition-all"
                                            style={{ fontFamily: "'Outfit', sans-serif" }}
                                            onFocus={e => { e.target.style.borderColor = MILA_RED; }}
                                            onBlur={e => { e.target.style.borderColor = '#E5E7EB'; }}>
                                            <option value="date-desc">Date (Plus récent)</option>
                                            <option value="date-asc">Date (Plus ancien)</option>
                                            <option value="name-asc">Nom (A–Z)</option>
                                            <option value="name-desc">Nom (Z–A)</option>
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

                {/* Compteur résultats */}
                <div className="flex items-center justify-between mb-6 px-1">
                    <p className="text-sm text-gray-500" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        <span className="font-bold text-gray-900">{filteredEvents.length}</span>{' '}
                        événement{filteredEvents.length > 1 ? 's' : ''} trouvé{filteredEvents.length > 1 ? 's' : ''}
                    </p>
                    {hasFilters && (
                        <button onClick={resetFilters}
                            className="text-sm font-semibold transition-colors hover:opacity-80"
                            style={{ color: MILA_RED, fontFamily: "'Outfit', sans-serif" }}>
                            Voir tous les événements
                        </button>
                    )}
                </div>

                {/* Grille / liste */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {[1,2,3,4,5,6].map(i => <CardSkeleton key={i} />)}
                    </div>
                ) : currentEvents.length === 0 ? (
                    <div className="text-center py-20 rounded-3xl border border-dashed"
                        style={{ borderColor: `${MILA_RED}25`, backgroundColor: `${MILA_RED}03` }}>
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                            style={{ background: `linear-gradient(135deg, ${MILA_RED_DARK}, ${MILA_RED})` }}>
                            <PartyPopper className="w-8 h-8 text-white" />
                        </div>
                        <h3 className="font-bold text-gray-800 text-xl mb-2"
                            style={{ fontFamily: "'Outfit', sans-serif" }}>
                            Aucun événement trouvé
                        </h3>
                        <p className="text-gray-500 text-sm mb-6"
                            style={{ fontFamily: "'Outfit', sans-serif" }}>
                            Essayez de modifier vos critères de recherche
                        </p>
                        <button onClick={resetFilters}
                            className="px-6 py-2.5 rounded-full font-semibold text-white text-sm"
                            style={{ background: `linear-gradient(135deg, ${MILA_RED_DARK}, ${MILA_RED})`, fontFamily: "'Outfit', sans-serif" }}>
                            Réinitialiser les filtres
                        </button>
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
                                {currentEvents.map((event, i) =>
                                    viewMode === 'grid'
                                        ? <EventCardGrid key={event._id} event={event} index={i} />
                                        : <EventCardList key={event._id} event={event} index={i} />
                                )}
                            </motion.div>
                        </AnimatePresence>
                        <Pagination totalPages={totalPages} currentPage={currentPage}
                            onPageChange={p => { setCurrentPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
                    </>
                )}
            </div>
        </div>
    );
};

export default MilaEventsAnnonces;