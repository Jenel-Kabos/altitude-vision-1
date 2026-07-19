"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import PropertyCard from '@/lib/components/PropertyCard.jsx';
import LoadingSpinner from '@/lib/components/UI/LoadingSpinner.jsx';
import { getPropertiesWithFilters } from '@/lib/services/propertyService';
import { VILLES, ARRONDISSEMENTS } from '@/lib/constants/locations';
import {
  TRANSACTIONS, PROPERTY_TYPES_WITH_ALL, BUDGET_PRESETS,
  PRICE_MAX, formatPriceShort, parseBudgetInput,
} from '@/lib/constants/propertyTypes';

// ── Constantes ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 12;

const DEFAULT_FILTERS = {
  search: '', transaction: 'tous', type: 'tous',
  city: 'Toutes', arrondissement: 'Tous',
  minPrice: 0, maxPrice: 0,
  sort: '-createdAt',
};

const SORTS = [
  { value: '-createdAt', label: 'Plus récents'     },
  { value: 'price',      label: 'Prix croissant'   },
  { value: '-price',     label: 'Prix décroissant' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function filtersFromSearchParams(params) {
  return {
    search:         params.get('search')         || DEFAULT_FILTERS.search,
    transaction:    params.get('transaction')    || DEFAULT_FILTERS.transaction,
    type:           params.get('type')           || DEFAULT_FILTERS.type,
    city:           params.get('city')           || DEFAULT_FILTERS.city,
    arrondissement: params.get('arrondissement') || DEFAULT_FILTERS.arrondissement,
    minPrice:       Number(params.get('minPrice')) || 0,
    maxPrice:       Number(params.get('maxPrice')) || 0,
    sort:           params.get('sort')           || DEFAULT_FILTERS.sort,
  };
}

function filtersToParams(filters) {
  const p = new URLSearchParams();
  if (filters.search)                         p.set('search', filters.search);
  if (filters.transaction !== 'tous')         p.set('transaction', filters.transaction);
  if (filters.type !== 'tous')                p.set('type', filters.type);
  if (filters.city !== 'Toutes')              p.set('city', filters.city);
  if (filters.arrondissement !== 'Tous')      p.set('arrondissement', filters.arrondissement);
  if (filters.minPrice > 0)                   p.set('minPrice', String(filters.minPrice));
  if (filters.maxPrice > 0)                   p.set('maxPrice', String(filters.maxPrice));
  if (filters.sort !== DEFAULT_FILTERS.sort)  p.set('sort', filters.sort);
  return p;
}

// ── Composant interne (lit les SearchParams) ──────────────────────────────────
function PropertiesContent() {
  const router   = useRouter();
  const pathname = usePathname();
  const params   = useSearchParams();

  const [filters, setFilters]             = useState(() => filtersFromSearchParams(params));
  const [properties, setProperties]       = useState([]);
  const [total, setTotal]                 = useState(0);
  const [page, setPage]                   = useState(1);
  const [loading, setLoading]             = useState(true);
  const [loadingMore, setLoadingMore]     = useState(false);
  const [error, setError]                 = useState(null);
  const [panelOpen, setPanelOpen]         = useState(false);

  // Budget — inputs texte libres (K / M notation)
  const [minInput, setMinInput] = useState(filters.minPrice ? formatPriceShort(filters.minPrice) : '');
  const [maxInput, setMaxInput] = useState(filters.maxPrice ? formatPriceShort(filters.maxPrice) : '');

  // Debounce search
  const searchRef = useRef(null);

  // Arrondissements disponibles
  const arrondOptions = useMemo(() =>
    filters.city !== 'Toutes' ? (ARRONDISSEMENTS[filters.city] || []) : [],
  [filters.city]);

  // ── Charger les biens ────────────────────────────────────────────────────
  const load = useCallback(async (f, p, append = false) => {
    append ? setLoadingMore(true) : setLoading(true);
    setError(null);
    try {
      const { properties: items, total: t } = await getPropertiesWithFilters({
        ...f, page: p, limit: PAGE_SIZE,
      });
      setProperties(prev => append ? [...prev, ...items] : items);
      setTotal(t);
    } catch {
      setError('Impossible de charger les annonces. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Rechargement quand les filtres changent + sync URL
  useEffect(() => {
    setPage(1);
    load(filters, 1, false);
    const qs = filtersToParams(filters).toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
  }, [filters, load, router, pathname]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleFilterChange = useCallback((key, value) => {
    setFilters(prev => {
      const next = { ...prev, [key]: value };
      if (key === 'city') next.arrondissement = 'Tous';
      return next;
    });
  }, []);

  const handleSearchChange = useCallback((val) => {
    clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => handleFilterChange('search', val), 400);
  }, [handleFilterChange]);

  const handleBudgetPreset = useCallback((preset) => {
    setMinInput(preset.min === 0 ? '' : formatPriceShort(preset.min));
    setMaxInput(preset.max >= PRICE_MAX ? '' : formatPriceShort(preset.max));
    setFilters(prev => ({ ...prev, minPrice: preset.min, maxPrice: preset.max >= PRICE_MAX ? 0 : preset.max }));
  }, []);

  const commitMin = useCallback(() => {
    const v = parseBudgetInput(minInput);
    const val = v !== null ? v : 0;
    setMinInput(val === 0 ? '' : formatPriceShort(val));
    handleFilterChange('minPrice', val);
  }, [minInput, handleFilterChange]);

  const commitMax = useCallback(() => {
    const v = parseBudgetInput(maxInput);
    const val = v !== null ? v : 0;
    setMaxInput(val === 0 ? '' : formatPriceShort(val));
    handleFilterChange('maxPrice', val);
  }, [maxInput, handleFilterChange]);

  const handleReset = useCallback(() => {
    setMinInput('');
    setMaxInput('');
    setFilters(DEFAULT_FILTERS);
  }, []);

  const handleLoadMore = useCallback(() => {
    if (loadingMore || page * PAGE_SIZE >= total) return;
    const next = page + 1;
    setPage(next);
    load(filters, next, true);
  }, [loadingMore, page, total, filters, load]);

  // ── Compteurs ─────────────────────────────────────────────────────────────
  const activeCount = useMemo(() => {
    let n = 0;
    if (filters.search)                    n++;
    if (filters.transaction !== 'tous')    n++;
    if (filters.type !== 'tous')           n++;
    if (filters.city !== 'Toutes')         n++;
    if (filters.arrondissement !== 'Tous') n++;
    if (filters.minPrice > 0 || filters.maxPrice > 0) n++;
    return n;
  }, [filters]);

  const hasMore = page * PAGE_SIZE < total;

  const isPriceDefault = filters.minPrice === 0 && filters.maxPrice === 0;
  const budgetLabel = isPriceDefault ? null
    : `${filters.minPrice > 0 ? formatPriceShort(filters.minPrice) : '0'} – ${filters.maxPrice > 0 ? formatPriceShort(filters.maxPrice) : '500M+'} FCFA`;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F5F3EF' }}>

      {/* ══ BARRE DE FILTRES STICKY ══════════════════════════════════════════ */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">

          {/* Ligne 1 : search + transaction + filtres + tri */}
          <div className="flex flex-wrap items-center gap-2.5">

            {/* Recherche */}
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                   fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                type="text"
                placeholder="Rechercher un bien…"
                defaultValue={filters.search}
                onChange={e => handleSearchChange(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl
                           bg-gray-50 focus:outline-none focus:border-yellow-500
                           focus:ring-2 focus:ring-yellow-500/20 transition-all placeholder-gray-400"
              />
            </div>

            {/* Chips transaction */}
            <div className="flex gap-1.5 flex-shrink-0">
              {TRANSACTIONS.map(t => (
                <button key={t.value}
                  onClick={() => handleFilterChange('transaction', t.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    filters.transaction === t.value
                      ? 'text-black shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  style={filters.transaction === t.value ? { backgroundColor: '#C8960C', color: '#000' } : {}}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Bouton filtres avancés */}
            <button
              onClick={() => setPanelOpen(v => !v)}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-sm font-medium
                         border transition-all flex-shrink-0"
              style={panelOpen || activeCount > 1
                ? { borderColor: '#C8960C', color: '#C8960C', backgroundColor: 'rgba(200,150,12,0.06)' }
                : { borderColor: '#E5E7EB', color: '#4B5563' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/>
                <line x1="12" y1="18" x2="12" y2="18"/>
              </svg>
              Filtres
              {activeCount > 0 && (
                <span className="flex items-center justify-center w-5 h-5 rounded-full text-white text-[10px] font-bold"
                      style={{ backgroundColor: '#C8960C' }}>
                  {activeCount}
                </span>
              )}
            </button>

            {/* Tri */}
            <select
              value={filters.sort}
              onChange={e => handleFilterChange('sort', e.target.value)}
              className="py-1.5 pl-3 pr-7 text-sm border border-gray-200 rounded-xl bg-gray-50
                         text-gray-700 focus:outline-none focus:border-yellow-500 appearance-none
                         cursor-pointer flex-shrink-0"
            >
              {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>

            {/* Réinitialiser */}
            {activeCount > 0 && (
              <button onClick={handleReset}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors underline flex-shrink-0">
                Tout effacer
              </button>
            )}
          </div>

          {/* ── PANNEAU FILTRES AVANCÉS ── */}
          {panelOpen && (
            <div className="border-t border-gray-100 pt-4 mt-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">

                {/* Type de bien */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">
                    Type de bien
                  </label>
                  <select value={filters.type}
                    onChange={e => handleFilterChange('type', e.target.value)}
                    className="w-full py-2 px-3 text-sm border border-gray-200 rounded-xl bg-gray-50
                               focus:outline-none focus:border-yellow-500 appearance-none cursor-pointer">
                    {PROPERTY_TYPES_WITH_ALL.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                {/* Ville */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">
                    Ville
                  </label>
                  <select value={filters.city}
                    onChange={e => handleFilterChange('city', e.target.value)}
                    className="w-full py-2 px-3 text-sm border border-gray-200 rounded-xl bg-gray-50
                               focus:outline-none focus:border-yellow-500 appearance-none cursor-pointer">
                    <option value="Toutes">Toutes les villes</option>
                    {VILLES.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>

                {/* Arrondissement */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">
                    Arrondissement
                  </label>
                  <select value={filters.arrondissement}
                    onChange={e => handleFilterChange('arrondissement', e.target.value)}
                    disabled={filters.city === 'Toutes'}
                    className="w-full py-2 px-3 text-sm border border-gray-200 rounded-xl bg-gray-50
                               focus:outline-none focus:border-yellow-500 appearance-none cursor-pointer
                               disabled:opacity-40 disabled:cursor-not-allowed">
                    <option value="Tous">Tous</option>
                    {arrondOptions.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>

                {/* Budget */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">
                    Budget (FCFA)
                  </label>

                  {/* Presets */}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {BUDGET_PRESETS.map(p => {
                      const active = filters.minPrice === p.min && (p.max >= PRICE_MAX ? filters.maxPrice === 0 : filters.maxPrice === p.max);
                      return (
                        <button key={p.label}
                          onClick={() => handleBudgetPreset(p)}
                          className="px-2 py-1 rounded-full text-[11px] font-medium border transition-all"
                          style={active
                            ? { backgroundColor: '#C8960C', borderColor: '#C8960C', color: '#000' }
                            : { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB', color: '#374151' }}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Inputs min/max avec notation K/M */}
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Min (ex: 5M)"
                      value={minInput}
                      onChange={e => setMinInput(e.target.value)}
                      onBlur={commitMin}
                      onKeyDown={e => e.key === 'Enter' && commitMin()}
                      autoCapitalize="characters"
                      className="flex-1 py-1.5 px-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50
                                 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/20"
                    />
                    <span className="text-gray-400 text-xs">–</span>
                    <input
                      type="text"
                      placeholder="Max (ex: 100M)"
                      value={maxInput}
                      onChange={e => setMaxInput(e.target.value)}
                      onBlur={commitMax}
                      onKeyDown={e => e.key === 'Enter' && commitMax()}
                      autoCapitalize="characters"
                      className="flex-1 py-1.5 px-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50
                                 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/20"
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">Ex: 500K · 2.5M · 100000000</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══ RÉSULTATS ════════════════════════════════════════════════════════ */}
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Résumé + chips actifs */}
        <div className="flex flex-wrap items-center gap-3 mb-6 min-h-[32px]">
          <p className="text-sm text-gray-500 flex-shrink-0">
            {loading ? 'Recherche…' : (
              total === 0
                ? 'Aucun bien trouvé'
                : `${total.toLocaleString('fr-FR')} bien${total > 1 ? 's' : ''}`
            )}
          </p>

          {/* Chips filtres actifs */}
          {!loading && (
            <>
              {filters.transaction !== 'tous' && (
                <FilterChip
                  label={TRANSACTIONS.find(t => t.value === filters.transaction)?.label || filters.transaction}
                  onRemove={() => handleFilterChange('transaction', 'tous')}
                />
              )}
              {filters.type !== 'tous' && (
                <FilterChip label={filters.type} onRemove={() => handleFilterChange('type', 'tous')} />
              )}
              {filters.city !== 'Toutes' && (
                <FilterChip label={filters.city} onRemove={() => handleFilterChange('city', 'Toutes')} />
              )}
              {filters.arrondissement !== 'Tous' && (
                <FilterChip label={filters.arrondissement} onRemove={() => handleFilterChange('arrondissement', 'Tous')} />
              )}
              {!isPriceDefault && budgetLabel && (
                <FilterChip
                  label={budgetLabel}
                  onRemove={() => {
                    setMinInput(''); setMaxInput('');
                    setFilters(prev => ({ ...prev, minPrice: 0, maxPrice: 0 }));
                  }}
                />
              )}
              {filters.search && (
                <FilterChip label={`"${filters.search}"`} onRemove={() => handleFilterChange('search', '')} />
              )}
            </>
          )}
        </div>

        {/* Grille */}
        {loading ? (
          <div className="flex justify-center py-20"><LoadingSpinner /></div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-5xl mb-4">⚠️</p>
            <p className="text-red-500 font-medium">{error}</p>
          </div>
        ) : properties.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-6xl mb-5">🏠</p>
            <p className="text-gray-700 font-semibold text-lg mb-2">Aucun bien ne correspond à vos critères</p>
            <p className="text-gray-400 text-sm mb-8">Élargissez vos critères de recherche</p>
            <button onClick={handleReset}
              className="px-6 py-3 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
              style={{ background: 'linear-gradient(135deg,#A07A0A,#C8960C)' }}>
              Voir tous les biens
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {properties.map(p => (
                <PropertyCard key={p._id} property={p} />
              ))}
            </div>

            {/* Pagination "Voir plus" */}
            {hasMore && (
              <div className="flex flex-col items-center mt-12 gap-2">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="px-8 py-3 text-white rounded-xl font-semibold text-sm
                             hover:opacity-90 disabled:opacity-50 transition-all"
                  style={{ backgroundColor: '#111318' }}
                >
                  {loadingMore
                    ? 'Chargement…'
                    : `Voir plus (${Math.min(PAGE_SIZE, total - page * PAGE_SIZE)} sur ${total - page * PAGE_SIZE} restants)`}
                </button>
                <p className="text-xs text-gray-400">{page * PAGE_SIZE} / {total} biens affichés</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Chip filtre actif ─────────────────────────────────────────────────────────
function FilterChip({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1 rounded-full text-xs font-semibold"
          style={{ backgroundColor: 'rgba(200,150,12,0.12)', border: '1px solid rgba(200,150,12,0.3)', color: '#8B6500' }}>
      {label}
      <button onClick={onRemove}
        className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-yellow-200 transition-colors"
        aria-label={`Supprimer le filtre ${label}`}>
        ✕
      </button>
    </span>
  );
}

// ── Export enveloppé dans Suspense (requis pour useSearchParams en Next.js) ───
export default function PropertiesPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><LoadingSpinner /></div>}>
      <PropertiesContent />
    </Suspense>
  );
}
