"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import PropertyCard from '@/lib/components/PropertyCard.jsx';
import LoadingSpinner from '@/lib/components/UI/LoadingSpinner.jsx';
import { getPropertiesWithFilters } from '@/lib/services/propertyService';
import { VILLES, ARRONDISSEMENTS } from '@/lib/constants/locations';

// ── Constantes ────────────────────────────────────────────────────────────────
const TRANSACTIONS = [
  { value: 'tous',     label: 'Tous' },
  { value: 'vente',    label: 'Vente' },
  { value: 'location', label: 'Location' },
];

const TYPES_BIEN = [
  'tous', 'Maison', 'Appartement', 'Villa', 'Terrain', 'Bureau',
  'Commerce', 'Entrepôt', 'Studio', 'Chambre',
];

const SORTS = [
  { value: '-createdAt', label: 'Plus récents' },
  { value: 'price',      label: 'Prix croissant' },
  { value: '-price',     label: 'Prix décroissant' },
];

const PAGE_SIZE = 12;

const DEFAULT_FILTERS = {
  search: '', transaction: 'tous', type: 'tous',
  city: 'Toutes', arrondissement: 'Tous',
  minPrice: 0, maxPrice: 0,
  sort: '-createdAt',
};

function formatPrice(n) {
  if (!n || n === 0) return '';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} Md`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)} M`;
  if (n >= 1_000)         return `${Math.round(n / 1_000)} K`;
  return String(n);
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function PropertiesPage() {
  const router      = useSearchParams(); // lecture URL params
  const [filters, setFilters]     = useState(DEFAULT_FILTERS);
  const [properties, setProperties] = useState([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]         = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);

  // Arrondissements disponibles pour la ville sélectionnée
  const arrondOptions = useMemo(() =>
    filters.city !== 'Toutes' ? (ARRONDISSEMENTS[filters.city] || []) : [],
  [filters.city]);

  // ── Chargement ────────────────────────────────────────────────────────────
  const load = useCallback(async (f, p, append = false) => {
    append ? setLoadingMore(true) : setLoading(true);
    try {
      const { properties: items, total: t } = await getPropertiesWithFilters({
        ...f, page: p, limit: PAGE_SIZE,
      });
      setProperties(prev => append ? [...prev, ...items] : items);
      setTotal(t);
      setError(null);
    } catch {
      setError('Impossible de charger les annonces. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Rechargement complet quand les filtres changent
  useEffect(() => {
    setPage(1);
    load(filters, 1, false);
  }, [filters, load]);

  const handleFilterChange = useCallback((key, value) => {
    setFilters(prev => {
      const next = { ...prev, [key]: value };
      // Réinitialise arrondissement si on change de ville
      if (key === 'city') next.arrondissement = 'Tous';
      return next;
    });
  }, []);

  const handleReset = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  const handleLoadMore = useCallback(() => {
    if (loadingMore || page * PAGE_SIZE >= total) return;
    const next = page + 1;
    setPage(next);
    load(filters, next, true);
  }, [loadingMore, page, total, filters, load]);

  // ── Compteur filtres actifs ────────────────────────────────────────────────
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-cream">
      {/* ─── Barre de filtres ─── */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3">

          {/* Recherche texte */}
          <div className="relative flex-1 min-w-[200px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                 fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Rechercher un bien…"
              value={filters.search}
              onChange={e => handleFilterChange('search', e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl
                         bg-gray-50 focus:outline-none focus:border-gold focus:ring-2
                         focus:ring-gold/20 transition-all"
            />
          </div>

          {/* Chips transaction */}
          <div className="flex gap-1.5">
            {TRANSACTIONS.map(t => (
              <button key={t.value}
                onClick={() => handleFilterChange('transaction', t.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  filters.transaction === t.value
                    ? 'bg-gold text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Bouton filtres avancés */}
          <button
            onClick={() => setPanelOpen(v => !v)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium
                        border transition-all ${
              panelOpen || activeCount > 1
                ? 'border-gold text-gold bg-gold/5'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/>
              <line x1="12" y1="18" x2="12" y2="18"/>
            </svg>
            Filtres
            {activeCount > 0 && (
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-gold text-white text-[10px] font-bold">
                {activeCount}
              </span>
            )}
          </button>

          {/* Tri */}
          <select
            value={filters.sort}
            onChange={e => handleFilterChange('sort', e.target.value)}
            className="py-1.5 pl-3 pr-8 text-sm border border-gray-200 rounded-xl bg-gray-50
                       text-gray-700 focus:outline-none focus:border-gold appearance-none cursor-pointer"
          >
            {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>

          {/* Reset */}
          {activeCount > 0 && (
            <button onClick={handleReset}
              className="text-xs text-gray-500 hover:text-red-500 transition-colors underline">
              Réinitialiser
            </button>
          )}
        </div>

        {/* ─── Panneau filtres avancés (accordéon) ─── */}
        {panelOpen && (
          <div className="border-t border-gray-100 bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 py-4 grid grid-cols-2 md:grid-cols-4 gap-4">

              {/* Type de bien */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                  Type de bien
                </label>
                <select value={filters.type}
                  onChange={e => handleFilterChange('type', e.target.value)}
                  className="w-full py-2 px-3 text-sm border border-gray-200 rounded-xl bg-white
                             focus:outline-none focus:border-gold appearance-none cursor-pointer">
                  {TYPES_BIEN.map(t => (
                    <option key={t} value={t}>{t === 'tous' ? 'Tous les types' : t}</option>
                  ))}
                </select>
              </div>

              {/* Ville */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                  Ville
                </label>
                <select value={filters.city}
                  onChange={e => handleFilterChange('city', e.target.value)}
                  className="w-full py-2 px-3 text-sm border border-gray-200 rounded-xl bg-white
                             focus:outline-none focus:border-gold appearance-none cursor-pointer">
                  <option value="Toutes">Toutes les villes</option>
                  {VILLES.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>

              {/* Arrondissement */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                  Arrondissement
                </label>
                <select value={filters.arrondissement}
                  onChange={e => handleFilterChange('arrondissement', e.target.value)}
                  disabled={filters.city === 'Toutes'}
                  className="w-full py-2 px-3 text-sm border border-gray-200 rounded-xl bg-white
                             focus:outline-none focus:border-gold appearance-none cursor-pointer
                             disabled:opacity-40 disabled:cursor-not-allowed">
                  <option value="Tous">Tous</option>
                  {arrondOptions.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>

              {/* Budget min / max */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                  Budget (FCFA)
                </label>
                <div className="flex gap-2">
                  <input type="number" placeholder="Min"
                    value={filters.minPrice || ''}
                    onChange={e => handleFilterChange('minPrice', Number(e.target.value) || 0)}
                    className="w-1/2 py-2 px-2 text-sm border border-gray-200 rounded-xl bg-white
                               focus:outline-none focus:border-gold"
                  />
                  <input type="number" placeholder="Max"
                    value={filters.maxPrice || ''}
                    onChange={e => handleFilterChange('maxPrice', Number(e.target.value) || 0)}
                    className="w-1/2 py-2 px-2 text-sm border border-gray-200 rounded-xl bg-white
                               focus:outline-none focus:border-gold"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Résultats ─── */}
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Résumé */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-gray-500">
            {loading ? 'Chargement…' : (
              total === 0
                ? 'Aucun bien trouvé'
                : `${total} bien${total > 1 ? 's' : ''} trouvé${total > 1 ? 's' : ''}`
            )}
          </p>
          {activeCount > 0 && !loading && (
            <div className="flex flex-wrap gap-2">
              {filters.transaction !== 'tous' && (
                <Chip label={filters.transaction} onRemove={() => handleFilterChange('transaction', 'tous')} />
              )}
              {filters.type !== 'tous' && (
                <Chip label={filters.type} onRemove={() => handleFilterChange('type', 'tous')} />
              )}
              {filters.city !== 'Toutes' && (
                <Chip label={filters.city} onRemove={() => handleFilterChange('city', 'Toutes')} />
              )}
              {filters.arrondissement !== 'Tous' && (
                <Chip label={filters.arrondissement} onRemove={() => handleFilterChange('arrondissement', 'Tous')} />
              )}
              {(filters.minPrice > 0 || filters.maxPrice > 0) && (
                <Chip
                  label={`${filters.minPrice > 0 ? formatPrice(filters.minPrice) : '0'} – ${filters.maxPrice > 0 ? formatPrice(filters.maxPrice) : 'Max'} FCFA`}
                  onRemove={() => { handleFilterChange('minPrice', 0); handleFilterChange('maxPrice', 0); }}
                />
              )}
            </div>
          )}
        </div>

        {/* Grille */}
        {loading ? (
          <LoadingSpinner />
        ) : error ? (
          <div className="text-center py-16 text-red-500">{error}</div>
        ) : properties.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">🏠</p>
            <p className="text-gray-600 font-medium mb-2">Aucun bien ne correspond à vos critères</p>
            <p className="text-gray-400 text-sm mb-6">Essayez d'élargir votre recherche</p>
            <button onClick={handleReset}
              className="px-5 py-2.5 bg-gold text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
              Voir tous les biens
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {properties.map(p => <PropertyCard key={p._id} property={p} />)}
            </div>

            {/* Load more */}
            {hasMore && (
              <div className="flex justify-center mt-10">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="px-8 py-3 bg-dark text-white rounded-xl font-semibold text-sm
                             hover:bg-dark/90 disabled:opacity-50 transition-all"
                >
                  {loadingMore ? 'Chargement…' : `Voir plus (${total - page * PAGE_SIZE} restants)`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Chip filtre actif ─────────────────────────────────────────────────────────
function Chip({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gold/10
                     border border-gold/30 text-xs font-medium text-gold">
      {label}
      <button onClick={onRemove} className="hover:text-gold/60 transition-colors" aria-label={`Supprimer ${label}`}>
        ✕
      </button>
    </span>
  );
}
