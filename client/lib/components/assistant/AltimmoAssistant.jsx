"use client";

// ALTIMMO-AI-01 → AI-INTEGRATION-02 — assistant de recherche Altimmo (web, sans connexion).
// Mise en page, saisie libre, résultats et comparaison repris d'AI-01, branchés sur le moteur
// IA-03 (POST /api/altimmo/assistant/search et /compare). Sans état serveur : aucune conversation
// n'est conservée. L'assistant n'est présenté comme utilisable que si le serveur confirme son
// activation (GET /assistant/status) ; un 503 en cours d'usage bascule sur l'état indisponible.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ComparisonPanel, ResultCard } from './AssistantResults';
import { compareWithAssistant, getAssistantStatus, searchWithAssistant } from '../../services/altimmoAssistantService';
import { classifyAssistantError, toComparisonView, toSearchView } from '../../utils/assistantViewModel';
import { PROPERTY_TYPES, OFFER_TYPES } from '../../constants/propertyTypes';
import { ACCOMMODATION_TYPES } from '../../constants/accommodation';
import { VILLES, getArrondissementsFor } from '../../constants/locations';

const MAX_COMPARE = 5;
const MAX_TEXT = 400;
// Seules Brazzaville et Pointe-Noire ont des arrondissements connus du moteur.
const ENGINE_DISTRICT_CITIES = ['Brazzaville', 'Pointe-Noire'];
const EMPTY_FILTERS = Object.freeze({ offerType: '', propertyType: '', accommodationType: '', city: '', arrondissement: '', minPrice: '', maxPrice: '', minBedrooms: '' });

const field = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
const label = 'flex flex-col gap-1 text-xs font-medium text-slate-600';

/** Filtres repris d'une liste d'annonces : seules les valeurs que le moteur sait traiter. */
function initialFormFilters(initialFilters) {
  const out = { ...EMPTY_FILTERS };
  Object.entries(initialFilters || {}).forEach(([key, value]) => { if (key in out) out[key] = value; });
  if (out.arrondissement && !ENGINE_DISTRICT_CITIES.some((city) => getArrondissementsFor(city).includes(out.arrondissement))) out.arrondissement = '';
  if (out.offerType === 'tous') out.offerType = '';
  return out;
}

function StatePanel({ title, children, tone = 'slate' }) {
  const tones = { slate: 'border-slate-200 bg-slate-50 text-slate-800', amber: 'border-amber-200 bg-amber-50 text-amber-900', red: 'border-red-200 bg-red-50 text-red-800' };
  return (
    <div role="status" className={`rounded-2xl border p-4 text-sm ${tones[tone]}`}>
      {title && <p className="font-semibold">{title}</p>}
      <div className="mt-1 space-y-1">{children}</div>
    </div>
  );
}

export default function AltimmoAssistant({ initialFilters = null }) {
  const [enabled, setEnabled] = useState(null);
  const [filters, setFilters] = useState(() => initialFormFilters(initialFilters));
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [view, setView] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [compareIds, setCompareIds] = useState([]);
  const lastRequest = useRef(null);
  const sequence = useRef(0);
  const autoStarted = useRef(false);

  const lodging = filters.offerType === 'hebergement';
  const districts = ENGINE_DISTRICT_CITIES.includes(filters.city) ? getArrondissementsFor(filters.city) : [];
  const setFilter = (key, value) => setFilters((current) => {
    const next = { ...current, [key]: value };
    if (key === 'city') next.arrondissement = '';
    if (key === 'offerType') { next.propertyType = ''; next.accommodationType = ''; }
    return next;
  });

  const handleError = useCallback((caught) => {
    const classified = classifyAssistantError(caught);
    if (classified.kind === 'disabled') setEnabled(false);
    setError(classified);
  }, []);

  const runSearch = useCallback(async (request) => {
    // Une seule requête à la fois ; une réponse tardive d'une recherche antérieure est ignorée.
    const id = sequence.current + 1;
    sequence.current = id;
    setBusy(true); setError(null); setComparison(null); setCompareIds([]);
    try {
      const envelope = await searchWithAssistant(request);
      if (sequence.current !== id) return;
      lastRequest.current = request;
      setView(toSearchView(envelope));
    } catch (caught) {
      if (sequence.current === id) handleError(caught);
    } finally {
      if (sequence.current === id) setBusy(false);
    }
  }, [handleError]);

  useEffect(() => {
    let active = true;
    getAssistantStatus().then((value) => { if (active) setEnabled(value); }).catch(() => {}); // getAssistantStatus ne rejette pas : garde de forme
    return () => { active = false; };
  }, []);

  // « Affiner avec l'assistant » : recherche lancée une fois avec les filtres repris de la liste.
  useEffect(() => {
    if (enabled !== true || autoStarted.current) return;
    autoStarted.current = true;
    const preset = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
    if (Object.keys(preset).length) runSearch({ filters: preset });
  }, [enabled, filters, runSearch]);

  const onSubmit = (event) => {
    event.preventDefault();
    if (busy) return;
    const active = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
    const query = text.trim();
    if (!query && !Object.keys(active).length) {
      setError({ kind: 'incomplete', message: 'Décrivez votre recherche ou choisissez au moins un critère.' });
      return;
    }
    runSearch({ query: query || undefined, filters: active });
  };

  const onCompare = async () => {
    if (busy || compareIds.length < 2) return;
    setBusy(true); setError(null);
    try {
      setComparison(toComparisonView(await compareWithAssistant({ propertyIds: compareIds, query: lastRequest.current?.query })));
    } catch (caught) {
      handleError(caught);
    } finally {
      setBusy(false);
    }
  };

  const onMore = () => view?.nextPageToken && lastRequest.current && runSearch({ ...lastRequest.current, pageToken: view.nextPageToken });
  const reset = () => { setFilters({ ...EMPTY_FILTERS }); setText(''); setView(null); setComparison(null); setCompareIds([]); setError(null); };
  const toggleCompare = (id) => setCompareIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id].slice(0, MAX_COMPARE)));

  const header = (
    <header>
      <h1 id="assistant-title" className="font-display text-3xl text-slate-900">Trouver mon bien avec l’assistant</h1>
      <p className="mt-1 text-sm text-slate-600">Achat, location ou hébergement : décrivez votre recherche ou choisissez vos critères. L’assistant compare uniquement les annonces publiées sur Altimmo.</p>
    </header>
  );

  if (enabled === null) {
    return <section className="mx-auto w-full max-w-4xl px-4 py-6" aria-labelledby="assistant-title">{header}<p role="status" className="mt-4 text-sm text-slate-500">Chargement de l’assistant…</p></section>;
  }
  if (enabled === false) {
    return (
      <section className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-6" aria-labelledby="assistant-title" data-testid="assistant-disabled">
        {header}
        <StatePanel title="L’assistant de recherche n’est pas encore disponible.">
          <p>Vous pouvez consulter toutes les annonces publiées et utiliser les filtres de recherche.</p>
          <Link href="/immobilier/annonces" className="inline-block font-semibold text-brand-blue underline">Voir les annonces</Link>
        </StatePanel>
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-6" aria-labelledby="assistant-title">
      {header}

      <form onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4" aria-label="Critères de recherche">
        <label htmlFor="assistant-text" className={label}>
          Décrivez votre recherche
          <textarea id="assistant-text" value={text} onChange={(e) => setText(e.target.value)} maxLength={MAX_TEXT} rows={2}
            placeholder="Ex. : maison 3 chambres à Bacongo avec parking, budget maximum 250 000 FCFA" className={field} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <label className={label}>Projet
            <select value={filters.offerType} onChange={(e) => setFilter('offerType', e.target.value)} className={field}>
              <option value="">Indifférent</option>
              {OFFER_TYPES.filter((option) => option.value !== 'tous').map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className={label}>Type de bien
            {lodging ? (
              <select value={filters.accommodationType} onChange={(e) => setFilter('accommodationType', e.target.value)} className={field}>
                <option value="">Tous</option>
                {ACCOMMODATION_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            ) : (
              <select value={filters.propertyType} onChange={(e) => setFilter('propertyType', e.target.value)} className={field}>
                <option value="">Tous</option>
                {PROPERTY_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            )}
          </label>
          <label className={label}>Ville
            <select value={filters.city} onChange={(e) => setFilter('city', e.target.value)} className={field}>
              <option value="">Toutes</option>
              {VILLES.map((city) => <option key={city} value={city}>{city}</option>)}
            </select>
          </label>
          <label className={label}>Arrondissement
            <select value={filters.arrondissement} onChange={(e) => setFilter('arrondissement', e.target.value)} className={field} disabled={!districts.length}>
              <option value="">Tous</option>
              {districts.map((district) => <option key={district} value={district}>{district}</option>)}
            </select>
          </label>
          <label className={label}>Budget minimum (FCFA)
            <input inputMode="numeric" value={filters.minPrice} onChange={(e) => setFilter('minPrice', e.target.value.replace(/\D/g, '').slice(0, 12))} className={field} />
          </label>
          <label className={label}>Budget maximum (FCFA)
            <input inputMode="numeric" value={filters.maxPrice} onChange={(e) => setFilter('maxPrice', e.target.value.replace(/\D/g, '').slice(0, 12))} className={field} />
          </label>
          {!lodging && (
            <label className={label}>Chambres minimum
              <input inputMode="numeric" value={filters.minBedrooms} onChange={(e) => setFilter('minBedrooms', e.target.value.replace(/\D/g, '').slice(0, 2))} className={field} />
            </label>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={busy} className="rounded-full bg-gold px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">Rechercher</button>
          <button type="button" onClick={reset} disabled={busy} className="rounded-full border px-4 py-2 text-sm">Effacer les critères</button>
        </div>
      </form>

      {busy && <p role="status" className="text-sm text-slate-500">L’assistant recherche…</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800" data-testid={`assistant-error-${error.kind}`}>{error.message}</p>}

      {view && (
        <div className="space-y-4" data-testid={`assistant-view-${view.kind}`}>
          {view.criteria.length > 0 && (
            <nav aria-label="Critères compris" className="flex flex-wrap gap-2">
              {view.criteria.map((chip) => (
                <span key={chip.key} className={`inline-flex min-h-[32px] items-center rounded-full border px-3 py-1 text-sm ${chip.verifiable ? 'border-brand-blue/40 bg-brand-blue/5 text-brand-blue' : 'border-amber-300 bg-amber-50 text-amber-900'}`}>
                  {chip.label}{chip.verifiable ? '' : ' (non vérifiable)'}
                </span>
              ))}
            </nav>
          )}
          {view.kind === 'incomplete' && (
            <StatePanel title="Critères incomplets" tone="amber">
              {view.questions.map((question) => <p key={question}>{question}</p>)}
            </StatePanel>
          )}
          {view.kind === 'invalid' && <StatePanel title="Votre demande n’a pas pu être traitée." tone="red"><p>Vérifiez les critères saisis.</p></StatePanel>}
          {view.unverifiable.length > 0 && (
            <StatePanel title="Données non vérifiables" tone="amber">{view.unverifiable.map((message) => <p key={message}>{message}</p>)}</StatePanel>
          )}
          {(view.kind === 'empty' || view.noExactMatch) && (
            <StatePanel title="Aucune annonce ne correspond exactement à tous vos critères.">
              <p>{view.toVerify.length ? 'Les biens ci-dessous peuvent convenir, mais certaines informations restent à vérifier.' : 'Modifiez ou retirez un critère pour élargir la recherche.'}</p>
            </StatePanel>
          )}
          {view.warnings.map((message) => <p key={message} className="text-xs text-slate-500">{message}</p>)}

          {view.results.length > 0 && (
            <section aria-label="Résultats" className="space-y-3">
              <p className="text-xs text-slate-500">{view.orderLabel}</p>
              <div className="grid gap-4 md:grid-cols-2">
                {view.results.map((card) => (
                  <ResultCard key={card.id} card={card} selected={compareIds.includes(card.id)} onToggleCompare={toggleCompare} compareDisabled={compareIds.length >= MAX_COMPARE} />
                ))}
              </div>
            </section>
          )}
          {view.toVerify.length > 0 && (
            <section aria-label="Biens à vérifier" className="space-y-3">
              <h2 className="font-semibold text-slate-900">Biens dont certaines informations sont à vérifier</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {view.toVerify.map((card) => (
                  <ResultCard key={card.id} card={card} selected={compareIds.includes(card.id)} onToggleCompare={toggleCompare} compareDisabled={compareIds.length >= MAX_COMPARE} />
                ))}
              </div>
            </section>
          )}
          {compareIds.length >= 2 && (
            <button type="button" disabled={busy} onClick={onCompare} className="rounded-full bg-brand-blue px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
              Comparer les {compareIds.length} biens sélectionnés
            </button>
          )}
          {view.nextPageToken && <button type="button" disabled={busy} onClick={onMore} className="rounded-full border px-4 py-2 text-sm">Page suivante</button>}
          {view.notices.map((message) => <p key={message} className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{message}</p>)}
        </div>
      )}

      <ComparisonPanel comparison={comparison} />

      <footer className="text-xs text-slate-500">
        <p>Les informations proviennent des annonces publiées. La proximité des services n’est pas encore vérifiée par l’assistant.</p>
      </footer>
    </section>
  );
}
