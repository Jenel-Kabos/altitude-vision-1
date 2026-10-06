"use client";

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Building2, Loader2, RefreshCw } from 'lucide-react';
import { usePlatformTenantRuntime } from '../../context/PlatformTenantRuntimeContext';
import {
  approvePropertyAdministration,
  listPropertyRegistry,
  rejectPropertyAdministration,
} from '../../services/propertyService';

const EMPTY_RESULT = { items: [], page: 1, limit: 20, total: 0, totalPages: 0 };
const money = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 });

export default function PropertyRegistry({ section = null }) {
  const { tenantLoading, selectedTenantId, selectedTenant, can, isTenantAdmin, scope } = usePlatformTenantRuntime();
  const scopeMode = scope?.mode || (selectedTenantId ? 'tenant' : 'unresolved');
  const platformMode = scopeMode === 'platform';
  const unresolved = scopeMode === 'unresolved';
  const canReadPlatform = !platformMode || can('platform.properties.read');
  const canManage = platformMode ? can('platform.properties.manage') : scopeMode === 'tenant' && isTenantAdmin;
  const scopeKey = scope?.key || (selectedTenantId ? `tenant:${selectedTenantId}` : 'unresolved');
  const sequence = useRef(0);
  const [result, setResult] = useState(EMPTY_RESULT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [offerType, setOfferType] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [city, setCity] = useState('');
  const [sort, setSort] = useState('newest');
  const [revision, setRevision] = useState(0);
  const [mutationId, setMutationId] = useState(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    const requestId = ++sequence.current;
    setResult(EMPTY_RESULT);
    setError(null);

    if (tenantLoading) {
      setLoading(true);
      return undefined;
    }
    if (unresolved) {
      setLoading(false);
      setError('unresolved');
      return undefined;
    }
    if (!canReadPlatform) {
      setLoading(false);
      setError('forbidden');
      return undefined;
    }

    setLoading(true);
    const params = { page, limit: 20, sort };
    if (search) params.search = search;
    if (section || offerType) params.offerType = section || offerType;
    if (propertyType) params.propertyType = propertyType;
    if (city) params.city = city;

    let active = true;
    listPropertyRegistry(params, { platformScoped: platformMode })
      .then((next) => {
        if (active && sequence.current === requestId) setResult(next);
      })
      .catch((requestError) => {
        if (active && sequence.current === requestId) {
          setError(requestError?.response?.status === 403 ? 'forbidden' : 'error');
        }
      })
      .finally(() => {
        if (active && sequence.current === requestId) setLoading(false);
      });
    return () => { active = false; };
  }, [scopeKey, tenantLoading, unresolved, canReadPlatform, platformMode, page, search, section, offerType, propertyType, city, sort, revision]);

  const resetPage = (setter) => (event) => {
    setPage(1);
    setter(event.target.value);
  };
  const refresh = () => setRevision((value) => value + 1);
  const hasQuery = Boolean(search || offerType || propertyType || city);
  const moderate = async (property, action) => {
    setMutationId(property._id);
    setError(null);
    try {
      const operation = action === 'approve' ? approvePropertyAdministration : rejectPropertyAdministration;
      await operation(property._id, { platformScoped: platformMode });
      refresh();
    } catch (requestError) {
      setError(requestError?.response?.status === 403 ? 'forbidden' : 'error');
    } finally {
      setMutationId(null);
    }
  };

  return (
    <section className="min-h-screen bg-slate-50 p-4 sm:p-8" aria-label="Administration immobilière">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center gap-3">
          <span className="rounded-xl bg-orange-500 p-3 text-white"><Building2 aria-hidden="true" /></span>
          <div>
            <h1 className="text-2xl font-black text-slate-950">
              {platformMode ? (section === 'vente' ? 'Ventes de la plateforme' : section === 'location' ? 'Locations de la plateforme' : 'Biens de la plateforme') : `${section === 'vente' ? 'Ventes' : section === 'location' ? 'Locations' : 'Biens'} — ${selectedTenant?.name || 'Tenant sélectionné'}`}
            </h1>
            <p className="text-sm text-slate-600">Administration {platformMode ? 'globale' : 'tenant'} · {result.total} bien{result.total > 1 ? 's' : ''}</p>
          </div>
        </div>

        {!tenantLoading && canReadPlatform && (
          <div className="mb-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-6">
            <input aria-label="Rechercher un bien" role="searchbox" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Titre, quartier, type…" className="rounded-lg border p-2 md:col-span-2" />
            {!section && <select aria-label="Offre" value={offerType} onChange={resetPage(setOfferType)} className="rounded-lg border p-2">
              <option value="">Toutes les offres</option><option value="vente">Vente</option><option value="location">Location</option>
            </select>}
            <select aria-label="Type de bien" value={propertyType} onChange={resetPage(setPropertyType)} className="rounded-lg border p-2">
              <option value="">Tous les types</option><option value="Villa">Villa</option><option value="Appartement">Appartement</option><option value="Maison">Maison</option>
            </select>
            <select aria-label="Ville" value={city} onChange={resetPage(setCity)} className="rounded-lg border p-2">
              <option value="">Toutes les villes</option><option value="Brazzaville">Brazzaville</option><option value="Pointe-Noire">Pointe-Noire</option>
            </select>
            <select aria-label="Tri" value={sort} onChange={resetPage(setSort)} className="rounded-lg border p-2">
              <option value="newest">Plus récents</option><option value="oldest">Plus anciens</option><option value="title">Titre</option><option value="priceAsc">Prix croissant</option><option value="priceDesc">Prix décroissant</option><option value="status">Statut</option>
            </select>
          </div>
        )}

        {loading && <div className="flex items-center justify-center gap-2 rounded-2xl bg-white p-12"><Loader2 className="animate-spin" /><span>Chargement des biens…</span></div>}
        {!loading && error === 'unresolved' && <State title="Contexte d’administration requis" detail="Sélectionnez un tenant ou utilisez une Vue plateforme pleinement habilitée." />}
        {!loading && error === 'forbidden' && <State title="Accès interdit" detail="La capability platform.properties.read est requise pour la Vue plateforme." />}
        {!loading && error === 'error' && <State title="Biens indisponibles" detail="Le registre n’a pas pu être chargé." action={refresh} />}
        {!loading && !error && result.items.length === 0 && (
          <State
            title={hasQuery ? 'Aucun bien ne correspond à votre recherche' : 'Aucun bien enregistré'}
            detail={hasQuery ? 'Modifiez les critères de recherche ou les filtres.' : 'Ce contexte ne contient aucun bien.'}
            action={refresh}
          />
        )}

        {!loading && !error && result.items.length > 0 && (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {result.items.map((property) => (
                <article key={property._id} data-testid={`property-registry-${property._id}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  {property.images?.[0] && <img src={property.images[0]} alt="" className="h-44 w-full object-cover" />}
                  <div className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">{property.status || 'Non classé'} · {property.statusAdmin || 'Sans statut'}</p>
                  <h2 className="mt-1 text-lg font-bold text-slate-950">{property.title}</h2>
                  <p className="mt-2 text-sm text-slate-600">{property.type || 'Type non renseigné'} · {[property.address?.arrondissement, property.address?.city].filter(Boolean).join(', ') || 'Adresse non renseignée'}</p>
                  <p className="mt-3 font-bold text-slate-900">{Number.isFinite(Number(property.price)) ? money.format(Number(property.price)) : 'Prix non renseigné'}</p>
                  <dl className="mt-4 border-t pt-3 text-sm">
                    <div><dt className="inline text-slate-500">Propriétaire : </dt><dd className="inline font-medium">{property.owner?.name || 'Propriétaire indisponible'}</dd></div>
                    <div><dt className="inline text-slate-500">Organisation : </dt><dd className="inline font-medium">{property.tenant?.name || 'Aucune organisation'}</dd></div>
                  </dl>
                  <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
                    <Link href={`/dashboard/properties/${property._id}`} className="rounded-lg border px-3 py-2 text-sm font-semibold">Ouvrir le cockpit</Link>
                    {canManage && <>
                      <button type="button" disabled={mutationId === property._id} onClick={() => moderate(property, 'approve')} aria-label={`Valider ${property.title}`} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Valider</button>
                      <button type="button" disabled={mutationId === property._id} onClick={() => moderate(property, 'reject')} aria-label={`Rejeter ${property.title}`} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Rejeter</button>
                    </>}
                  </div>
                  </div>
                </article>
              ))}
            </div>
            <div className="mt-6 flex items-center justify-between rounded-xl bg-white p-4">
              <button type="button" aria-label="Page précédente" disabled={result.page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border px-4 py-2 disabled:opacity-40">Précédente</button>
              <span>Page {result.page} sur {result.totalPages}</span>
              <button type="button" aria-label="Page suivante" disabled={result.page >= result.totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-4 py-2 disabled:opacity-40">Suivante</button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function State({ title, detail, action = null }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
      <h2 className="text-lg font-bold">{title}</h2><p className="mt-2 text-sm text-slate-600">{detail}</p>
      {action && <button type="button" onClick={action} className="mt-4 inline-flex items-center gap-2 rounded-lg border px-4 py-2"><RefreshCw size={16} />Actualiser</button>}
    </div>
  );
}
