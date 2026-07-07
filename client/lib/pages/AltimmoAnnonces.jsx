"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Home, Search, X, AlertCircle,
    ChevronLeft, ChevronRight, Grid3x3, List,
    SlidersHorizontal, Building2, Tag, AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';
import { getPropertiesWithFilters } from '../services/propertyService';
import PropertyCard          from '../components/PropertyCard';
import { PropertySkeletonGrid, PropertySkeletonList } from '../components/PropertySkeleton';
import { VILLES, getArrondissementsFor } from '../constants/locations';
import { PROPERTY_TYPES_WITH_ALL, TRANSACTIONS } from '../constants/propertyTypes';

// ─────────────────────────────────────────────────────────────
const GOLD      = '#C8960C';
const GOLD_DARK = '#9A710A';
const DARK      = '#090B0E';

const PROPERTIES_PER_PAGE = 12;

const VILLES_WITH_ALL = ['Toutes', ...VILLES];

const DEFAULT_FILTERS = {
    search: '', status: 'tous', type: 'tous',
    ville: 'Toutes', arrondissement: 'Tous',
    price: { min: '', max: '' },
};

// ── Animation variants ────────────────────────────────────────
const containerVariants = {
    hidden: {},
    visible: {
        transition: {
            staggerChildren: 0.07,
            delayChildren:   0.05,
        },
    },
};

const cardVariants = {
    hidden:  { opacity: 0, y: 28, scale: 0.97 },
    visible: {
        opacity: 1, y: 0, scale: 1,
        transition: { type: 'spring', stiffness: 260, damping: 22 },
    },
};

// ─────────────────────────────────────────────────────────────
const Pagination = ({ totalPages, currentPage, onPageChange }) => {
    if (totalPages <= 1) return null;
    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 48 }}>
            <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                aria-label="Page précédente"
                style={{
                    width: 36, height: 36, border: '1px solid rgba(200,150,12,0.2)',
                    background: '#FFFFFF', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', cursor: currentPage === 1 ? 'default' : 'pointer',
                    opacity: currentPage === 1 ? 0.3 : 1, transition: '0.2s',
                    borderRadius: 0,
                }}>
                <ChevronLeft size={16} color="#6B5D52" />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                    key={p}
                    onClick={() => onPageChange(p)}
                    aria-label={`Page ${p}`}
                    aria-current={p === currentPage ? 'page' : undefined}
                    style={{
                        minWidth: 36, height: 36, padding: '0 10px',
                        background: p === currentPage
                            ? `linear-gradient(135deg, ${GOLD_DARK}, ${GOLD})`
                            : '#FFFFFF',
                        color:  p === currentPage ? '#0A0C0F' : '#6B5D52',
                        border: `1px solid ${p === currentPage ? 'transparent' : 'rgba(200,150,12,0.15)'}`,
                        boxShadow: p === currentPage ? `0 4px 16px rgba(200,150,12,0.28)` : 'none',
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: '0.85rem',
                        fontWeight: p === currentPage ? 700 : 400,
                        cursor: 'pointer',
                        transition: '0.2s',
                        borderRadius: 0,
                    }}>
                    {p}
                </button>
            ))}

            <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                aria-label="Page suivante"
                style={{
                    width: 36, height: 36, border: '1px solid rgba(200,150,12,0.2)',
                    background: '#FFFFFF', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', cursor: currentPage === totalPages ? 'default' : 'pointer',
                    opacity: currentPage === totalPages ? 0.3 : 1, transition: '0.2s',
                    borderRadius: 0,
                }}>
                <ChevronRight size={16} color="#6B5D52" />
            </button>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────
const AltimmoAnnonces = () => {
    const searchParams = useSearchParams();
    const router = useRouter();

    const [properties,   setProperties]  = useState([]);
    const [total,        setTotal]       = useState(0);
    const [totalAll,     setTotalAll]    = useState(0);
    const [loading,      setLoading]     = useState(true);
    const [error,        setError]       = useState(null);
    const [currentPage,  setPage]        = useState(1);
    const [showFilters,  setShowFilters] = useState(false);
    const [viewMode,     setViewMode]    = useState('grid');

    // ── État "draft" : ce que l'utilisateur modifie, pas encore appliqué ────
    const [draftSearch, setDraftSearch] = useState(searchParams.get('search') || '');
    const [draftStatus, setDraftStatus] = useState(searchParams.get('status') || 'tous');
    const [draftType,   setDraftType]   = useState(searchParams.get('type')   || 'tous');
    const [draftVille,  setDraftVille]  = useState(searchParams.get('ville')  || 'Toutes');
    const [draftArr,    setDraftArr]    = useState(searchParams.get('arrondissement') || 'Tous');
    const [draftPrice,  setDraftPrice]  = useState({
        min: searchParams.get('priceMin') || '',
        max: searchParams.get('priceMax') || '',
    });

    // ── État "appliqué" : seul déclencheur du fetch, mis à jour par "Rechercher" ──
    const [appliedFilters, setAppliedFilters] = useState({
        search: draftSearch, status: draftStatus, type: draftType,
        ville: draftVille, arrondissement: draftArr, price: draftPrice,
    });

    const handleVilleChange = (ville) => {
        setDraftVille(ville);
        setDraftArr('Tous');
    };

    // Nombre total de biens Altimmo disponibles, indépendamment des filtres (affiché dans le hero).
    useEffect(() => {
        getPropertiesWithFilters({ page: 1, limit: 1 })
            .then(({ total: t }) => setTotalAll(t))
            .catch(() => {});
    }, []);

    const fetchProperties = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const { properties: data, total: t } = await getPropertiesWithFilters({
                search:         appliedFilters.search,
                transaction:    appliedFilters.status,
                type:           appliedFilters.type,
                city:           appliedFilters.ville,
                arrondissement: appliedFilters.arrondissement,
                minPrice:       Number(appliedFilters.price.min) || 0,
                maxPrice:       Number(appliedFilters.price.max) || undefined,
                page:           currentPage,
                limit:          PROPERTIES_PER_PAGE,
            });
            setProperties(data);
            setTotal(t);
        } catch {
            setError('Impossible de charger les annonces. Veuillez réessayer.');
        } finally {
            setLoading(false);
        }
    }, [appliedFilters, currentPage]);

    useEffect(() => { fetchProperties(); }, [fetchProperties]);

    // Revenir en page 1 quand les filtres appliqués changent (mais pas quand on change juste de page).
    useEffect(() => {
        setPage(1);
    }, [appliedFilters]);

    useEffect(() => {
        const params = new URLSearchParams();
        if (appliedFilters.search)                     params.set('search',         appliedFilters.search);
        if (appliedFilters.status !== 'tous')          params.set('status',         appliedFilters.status);
        if (appliedFilters.type   !== 'tous')          params.set('type',           appliedFilters.type);
        if (appliedFilters.ville  !== 'Toutes')        params.set('ville',          appliedFilters.ville);
        if (appliedFilters.arrondissement !== 'Tous')  params.set('arrondissement', appliedFilters.arrondissement);
        if (appliedFilters.price.min)                  params.set('priceMin',       appliedFilters.price.min);
        if (appliedFilters.price.max)                  params.set('priceMax',       appliedFilters.price.max);
        const query = params.toString();
        router.replace(query ? `/altimmo/annonces?${query}` : '/altimmo/annonces');
    }, [appliedFilters, router]);

    const handleSearch = () => {
        setAppliedFilters({
            search:         draftSearch,
            status:         draftStatus,
            type:           draftType,
            ville:          draftVille,
            arrondissement: draftArr,
            price:          draftPrice,
        });
    };

    const handleReset = () => {
        setDraftSearch(DEFAULT_FILTERS.search);
        setDraftStatus(DEFAULT_FILTERS.status);
        setDraftType(DEFAULT_FILTERS.type);
        setDraftVille(DEFAULT_FILTERS.ville);
        setDraftArr(DEFAULT_FILTERS.arrondissement);
        setDraftPrice(DEFAULT_FILTERS.price);
        setAppliedFilters(DEFAULT_FILTERS);
    };

    const hasFilters = appliedFilters.search.trim() || appliedFilters.status !== 'tous' ||
        appliedFilters.type !== 'tous' || appliedFilters.ville !== 'Toutes' ||
        appliedFilters.arrondissement !== 'Tous' || appliedFilters.price.min || appliedFilters.price.max;

    const priceRangeInvalid = draftPrice.min && draftPrice.max &&
        Number(draftPrice.min) > Number(draftPrice.max);

    const totalPages        = Math.ceil(total / PROPERTIES_PER_PAGE);
    const currentProperties = properties;

    const inputFocus = e => { e.target.style.borderColor = GOLD; e.target.style.boxShadow = `0 0 0 3px rgba(200,150,12,0.12)`; };
    const inputBlur  = e => { e.target.style.borderColor = 'rgba(200,150,12,0.18)'; e.target.style.boxShadow = 'none'; };

    // Shared select / input style
    const inputStyle = {
        fontFamily: "'DM Sans', sans-serif",
        fontSize: '0.875rem',
        color: '#1A1612',
        background: '#F9FAFB',
        border: '1px solid rgba(200,150,12,0.18)',
        borderRadius: 0,
        padding: '10px 14px',
        width: '100%',
        outline: 'none',
        transition: '0.2s',
    };

    if (error) return (
        <div style={{ minHeight: '100vh', background: '#F8F8F8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: '#FFFFFF', border: '1px solid rgba(200,150,12,0.15)', padding: 40, maxWidth: 400, width: '100%', textAlign: 'center' }}>
                <div style={{ width: 56, height: 56, background: 'rgba(200,150,12,0.08)', border: '1px solid rgba(200,150,12,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                    <AlertCircle size={24} color={GOLD} />
                </div>
                <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.3rem', fontWeight: 700, color: '#1A1612', marginBottom: 8 }}>
                    Erreur de chargement
                </h3>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', color: '#6B5D52', marginBottom: 24 }}>{error}</p>
                <button onClick={fetchProperties}
                    style={{ padding: '12px 28px', background: GOLD, color: '#0A0C0F', border: 'none', borderRadius: 0, fontFamily: "'DM Sans', sans-serif", fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer', minHeight: 44 }}>
                    Réessayer
                </button>
            </div>
        </div>
    );

    return (
        <div style={{ minHeight: '100vh', background: '#F8F8F8', fontFamily: "'DM Sans', sans-serif" }}>

            {/* ── Hero ─────────────────────────────────── */}
            <div style={{
                position: 'relative',
                padding: 'clamp(64px, 10vw, 120px) 0',
                overflow: 'hidden',
                backgroundImage: "linear-gradient(to bottom, rgba(9,11,14,0.90) 0%, rgba(9,11,14,0.97) 100%), url('https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=2073&auto=format&fit=crop')",
                backgroundSize: 'cover',
                backgroundPosition: 'center',
            }}>
                {/* Gold top line */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }} />

                <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 clamp(16px, 4vw, 48px)', position: 'relative', zIndex: 1 }}>
                    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: 'easeOut' }}>
                        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(200,150,12,0.7)', marginBottom: 16 }}>
                            Altimmo
                        </p>
                        <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(2.2rem, 5vw, 4.5rem)', fontWeight: 700, lineHeight: 1.1, color: '#F0EDE8', marginBottom: 16, maxWidth: 700 }}>
                            Nos Biens Immobiliers
                        </h1>
                        <div style={{ height: 2, width: 56, background: `linear-gradient(90deg, ${GOLD}, transparent)`, marginBottom: 16 }} />
                        <p style={{ color: 'rgba(240,237,232,0.55)', maxWidth: 480, lineHeight: 1.7, marginBottom: 32, fontSize: '0.95rem' }}>
                            Découvrez notre sélection de propriétés exceptionnelles pour votre projet immobilier.
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px', border: '1px solid rgba(200,150,12,0.22)', background: 'rgba(200,150,12,0.06)', backdropFilter: 'blur(8px)', fontSize: '0.82rem', fontWeight: 600 }}>
                                <Building2 size={14} color={GOLD} />
                                <span style={{ color: GOLD }}>{totalAll}</span>
                                <span style={{ color: 'rgba(240,237,232,0.6)' }}>Biens</span>
                            </div>
                            {appliedFilters.status !== 'tous' && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px', border: '1px solid rgba(200,150,12,0.22)', background: 'rgba(200,150,12,0.1)', fontSize: '0.82rem', fontWeight: 600, color: GOLD, textTransform: 'capitalize' }}>
                                    <Tag size={14} />
                                    {TRANSACTIONS.find(t => t.value === appliedFilters.status)?.label}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* ── Contenu ──────────────────────────────── */}
            <div style={{ maxWidth: 1280, margin: '0 auto', padding: 'clamp(24px, 4vw, 48px) clamp(16px, 4vw, 48px)' }}>

                {/* Barre recherche */}
                <div style={{ background: '#FFFFFF', border: '1px solid rgba(200,150,12,0.15)', padding: 'clamp(16px, 2vw, 24px)', marginBottom: 24 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                        {/* Search input */}
                        <div style={{ position: 'relative', flex: '1 1 220px' }}>
                            <Search size={15} color="#9A8A7A" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                            <input
                                type="text"
                                placeholder="Rechercher un bien, une ville, un quartier..."
                                aria-label="Rechercher un bien"
                                value={draftSearch}
                                onChange={e => setDraftSearch(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                style={{ ...inputStyle, paddingLeft: 36, paddingRight: draftSearch ? 36 : 14 }}
                                onFocus={inputFocus}
                                onBlur={inputBlur}
                            />
                            {draftSearch && (
                                <button onClick={() => setDraftSearch('')} aria-label="Effacer la recherche"
                                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
                                    <X size={13} color="#9A8A7A" />
                                </button>
                            )}
                        </div>

                        {/* Filters toggle */}
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px',
                                background: (showFilters || hasFilters) ? GOLD : 'transparent',
                                color:      (showFilters || hasFilters) ? '#0A0C0F' : '#6B5D52',
                                border:     `1px solid ${(showFilters || hasFilters) ? GOLD : 'rgba(200,150,12,0.18)'}`,
                                borderRadius: 0,
                                fontFamily: "'DM Sans', sans-serif",
                                fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.05em',
                                textTransform: 'uppercase', cursor: 'pointer', minHeight: 44,
                                position: 'relative', transition: '0.2s',
                            }}>
                            <SlidersHorizontal size={14} />
                            Filtres
                            {hasFilters && !showFilters && (
                                <span style={{ position: 'absolute', top: -6, right: -6, width: 16, height: 16, background: '#DC2626', borderRadius: '50%', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>!</span>
                            )}
                        </button>

                        {/* View mode toggle */}
                        <div style={{ display: 'flex', border: '1px solid rgba(200,150,12,0.18)', overflow: 'hidden' }}>
                            {[{ mode: 'grid', Icon: Grid3x3, label: 'Vue grille' }, { mode: 'list', Icon: List, label: 'Vue liste' }].map(({ mode, Icon, label }) => (
                                <button key={mode} onClick={() => setViewMode(mode)} aria-label={label} aria-pressed={viewMode === mode}
                                    style={{
                                        padding: '10px 14px', border: 'none',
                                        background: viewMode === mode ? GOLD : 'transparent',
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        transition: '0.2s', minHeight: 44,
                                    }}>
                                    <Icon size={15} color={viewMode === mode ? '#0A0C0F' : '#9A8A7A'} />
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Panneau filtres */}
                    <AnimatePresence>
                        {showFilters && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3 }}
                                style={{ overflow: 'hidden' }}>
                                <div style={{ paddingTop: 20, marginTop: 20, borderTop: '1px solid rgba(200,150,12,0.12)' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 20 }}>

                                        {/* Transaction */}
                                        <div>
                                            <label style={{ display: 'block', fontFamily: "'DM Sans', sans-serif", fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9A8A7A', marginBottom: 10 }}>
                                                Transaction
                                            </label>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                                {TRANSACTIONS.map(({ value, label }) => (
                                                    <button key={value} onClick={() => setDraftStatus(value)}
                                                        style={{
                                                            padding: '6px 14px', borderRadius: 0,
                                                            background: draftStatus === value ? GOLD : 'transparent',
                                                            color:      draftStatus === value ? '#0A0C0F' : '#6B5D52',
                                                            border:     `1px solid ${draftStatus === value ? GOLD : 'rgba(200,150,12,0.18)'}`,
                                                            fontFamily: "'DM Sans', sans-serif",
                                                            fontSize: '0.78rem', fontWeight: draftStatus === value ? 700 : 400,
                                                            cursor: 'pointer', transition: '0.2s',
                                                        }}>
                                                        {label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Type de bien */}
                                        <div>
                                            <label htmlFor="filter-type" style={{ display: 'block', fontFamily: "'DM Sans', sans-serif", fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9A8A7A', marginBottom: 10 }}>
                                                Type de bien
                                            </label>
                                            <select id="filter-type" value={draftType} onChange={e => setDraftType(e.target.value)}
                                                style={inputStyle} onFocus={inputFocus} onBlur={inputBlur}>
                                                {PROPERTY_TYPES_WITH_ALL.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                                            </select>
                                        </div>

                                        {/* Ville */}
                                        <div>
                                            <label htmlFor="filter-ville" style={{ display: 'block', fontFamily: "'DM Sans', sans-serif", fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9A8A7A', marginBottom: 10 }}>
                                                Ville
                                            </label>
                                            <select id="filter-ville" value={draftVille} onChange={e => handleVilleChange(e.target.value)}
                                                style={inputStyle} onFocus={inputFocus} onBlur={inputBlur}>
                                                {VILLES_WITH_ALL.map(v => <option key={v} value={v}>{v}</option>)}
                                            </select>
                                        </div>

                                        {/* Arrondissement */}
                                        <div>
                                            <label htmlFor="filter-arr" style={{ display: 'block', fontFamily: "'DM Sans', sans-serif", fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9A8A7A', marginBottom: 10 }}>
                                                Arrondissement
                                            </label>
                                            <select id="filter-arr" value={draftArr} onChange={e => setDraftArr(e.target.value)}
                                                disabled={draftVille === 'Toutes'}
                                                style={{ ...inputStyle, opacity: draftVille === 'Toutes' ? 0.5 : 1, cursor: draftVille === 'Toutes' ? 'not-allowed' : 'pointer' }}
                                                onFocus={inputFocus} onBlur={inputBlur}>
                                                <option value="Tous">Tous</option>
                                                {getArrondissementsFor(draftVille).map(a => <option key={a} value={a}>{a}</option>)}
                                            </select>
                                        </div>

                                        {/* Prix */}
                                        <div style={{ gridColumn: 'span 2' }}>
                                            <label style={{ display: 'block', fontFamily: "'DM Sans', sans-serif", fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9A8A7A', marginBottom: 10 }}>
                                                Prix (FCFA)
                                            </label>
                                            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                                <input type="number" placeholder="Min" aria-label="Prix minimum (FCFA)"
                                                    value={draftPrice.min}
                                                    onChange={e => setDraftPrice(p => ({ ...p, min: e.target.value }))}
                                                    style={{ ...inputStyle, borderColor: priceRangeInvalid ? '#DC2626' : 'rgba(200,150,12,0.18)' }}
                                                    onFocus={inputFocus} onBlur={inputBlur} />
                                                <span style={{ color: '#9A8A7A', fontWeight: 700, flexShrink: 0 }} aria-hidden="true">—</span>
                                                <input type="number" placeholder="Max" aria-label="Prix maximum (FCFA)"
                                                    value={draftPrice.max}
                                                    onChange={e => setDraftPrice(p => ({ ...p, max: e.target.value }))}
                                                    style={{ ...inputStyle, borderColor: priceRangeInvalid ? '#DC2626' : 'rgba(200,150,12,0.18)' }}
                                                    onFocus={inputFocus} onBlur={inputBlur} />
                                            </div>
                                            {priceRangeInvalid && (
                                                <p style={{ marginTop: 6, fontSize: '0.75rem', color: '#DC2626', fontFamily: "'DM Sans', sans-serif" }}>
                                                    Le prix minimum ne peut pas dépasser le maximum.
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
                                        <button onClick={handleReset}
                                            style={{
                                                padding: '10px 24px', background: 'transparent', color: '#6B5D52',
                                                border: '1px solid rgba(200,150,12,0.3)', borderRadius: 0,
                                                fontFamily: "'DM Sans', sans-serif", fontSize: '0.8rem', fontWeight: 600,
                                                letterSpacing: '0.05em', textTransform: 'uppercase', cursor: 'pointer', minHeight: 44,
                                            }}>
                                            Réinitialiser
                                        </button>
                                        <button onClick={handleSearch}
                                            disabled={priceRangeInvalid}
                                            style={{
                                                padding: '10px 32px', background: GOLD, color: '#0A0C0F',
                                                border: 'none', borderRadius: 0,
                                                fontFamily: "'DM Sans', sans-serif", fontSize: '0.8rem', fontWeight: 700,
                                                letterSpacing: '0.05em', textTransform: 'uppercase', cursor: priceRangeInvalid ? 'not-allowed' : 'pointer',
                                                opacity: priceRangeInvalid ? 0.5 : 1, minHeight: 44,
                                            }}>
                                            Rechercher
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Compteur */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', color: '#6B5D52' }}>
                        <span style={{ fontWeight: 700, color: '#1A1612' }}>{total}</span>{' '}
                        bien{total > 1 ? 's' : ''} trouvé{total > 1 ? 's' : ''}
                        {appliedFilters.status !== 'tous' && (
                            <span style={{ marginLeft: 8, padding: '2px 10px', background: 'rgba(200,150,12,0.1)', color: GOLD, fontSize: '0.78rem', fontWeight: 700, textTransform: 'capitalize' }}>
                                {TRANSACTIONS.find(t => t.value === appliedFilters.status)?.label}
                            </span>
                        )}
                    </p>
                    {hasFilters && (
                        <button onClick={handleReset}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', fontFamily: "'DM Sans', sans-serif", fontSize: '0.82rem', fontWeight: 600, color: GOLD, cursor: 'pointer' }}>
                            <X size={13} /> Voir tous les biens
                        </button>
                    )}
                </div>

                {/* Résultats */}
                {loading ? (
                    viewMode === 'list' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(12px, 1.5vw, 20px)' }}>
                            {[1, 2, 3, 4].map(i => <PropertySkeletonList key={i} />)}
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'clamp(16px, 2vw, 24px)' }}>
                            {[1, 2, 3, 4, 5, 6].map(i => <PropertySkeletonGrid key={i} />)}
                        </div>
                    )
                ) : currentProperties.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{ textAlign: 'center', padding: 'clamp(48px, 8vw, 96px) 24px', border: '1px dashed rgba(200,150,12,0.25)', background: 'rgba(200,150,12,0.02)' }}>
                        <div style={{ width: 64, height: 64, background: 'rgba(200,150,12,0.08)', border: '1px solid rgba(200,150,12,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                            <Home size={28} color={GOLD} />
                        </div>
                        <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.5rem', fontWeight: 700, color: '#1A1612', marginBottom: 8 }}>
                            Aucun bien trouvé
                        </h3>
                        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', color: '#6B5D52', marginBottom: 24 }}>
                            {hasFilters ? 'Essayez de modifier vos critères de recherche' : 'Aucun bien disponible pour le moment'}
                        </p>
                        {hasFilters && (
                            <button onClick={handleReset}
                                style={{ padding: '12px 28px', background: GOLD, color: '#0A0C0F', border: 'none', borderRadius: 0, fontFamily: "'DM Sans', sans-serif", fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer', minHeight: 44 }}>
                                Réinitialiser les filtres
                            </button>
                        )}
                    </motion.div>
                ) : (
                    <>
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={`${viewMode}-${currentPage}`}
                                variants={containerVariants}
                                initial="hidden"
                                animate="visible"
                                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                                style={viewMode === 'grid'
                                    ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'clamp(16px, 2vw, 24px)' }
                                    : { display: 'flex', flexDirection: 'column', gap: 'clamp(12px, 1.5vw, 20px)' }
                                }>
                                {currentProperties.map((property, i) => (
                                    <motion.div key={property._id} variants={cardVariants}>
                                        <PropertyCard property={property} index={i} viewMode={viewMode} />
                                        <div style={{ textAlign: 'center', paddingTop: 6 }}>
                                            <Link href={`/signaler-un-litige?bien=${property._id}`}
                                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', color: '#B0A090', textDecoration: 'none' }}>
                                                <AlertTriangle size={10} />
                                                Signaler cette annonce
                                            </Link>
                                        </div>
                                    </motion.div>
                                ))}
                            </motion.div>
                        </AnimatePresence>

                        <Pagination
                            totalPages={totalPages}
                            currentPage={currentPage}
                            onPageChange={p => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        />
                    </>
                )}
            </div>
        </div>
    );
};

export default AltimmoAnnonces;