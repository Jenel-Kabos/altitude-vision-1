"use client";

// ALTIMMO-AI-01 → AI-INTEGRATION-02 — cartes de biens et comparaison, branchées sur le contrat
// IA-03 via `utils/assistantViewModel.js`. Tous les textes viennent du moteur et des annonces
// publiées ; aucun score n'est affiché. La conversion passe par la fiche officielle Altimmo.
import React from 'react';
import Link from 'next/link';
import { resolveWebDestination } from '../../navigation/navigationSdk';

const ALTITUDE_VISION_WHATSAPP = '242068002151'; // numéro de l'agence déjà utilisé par le site
export const advisorWhatsAppUrl = (title) => `https://wa.me/${ALTITUDE_VISION_WHATSAPP}?text=${encodeURIComponent(
  `Bonjour Altitude Vision, je souhaite être accompagné(e) pour le bien « ${title} » trouvé avec l'assistant Altimmo.`,
)}`;

/** Fiche officielle : page hôtel pour un établissement, fiche d'annonce sinon (registre de navigation). */
export const listingHref = (card) => (card.hotelId
  ? resolveWebDestination('HOTEL_DETAIL', { hotelId: card.hotelId })
  : resolveWebDestination('PROPERTY_DETAILS', { id: card.id }));

const CATEGORY_LABELS = { classic: null, furnished: 'Logement meublé', hotel: 'Hôtel', lodging: 'Hébergement' };

function List({ title, items, tone, marker }) {
  if (!items.length) return null;
  return (
    <div className="mt-3">
      <p className={`text-sm font-semibold ${tone}`}>{title}</p>
      <ul className="mt-1 space-y-1 text-sm text-slate-700">{items.map((item) => <li key={item}>{marker} {item}</li>)}</ul>
    </div>
  );
}

export function ResultCard({ card, selected = false, onToggleCompare, compareDisabled = false }) {
  const category = CATEGORY_LABELS[card.category];
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby={`result-${card.id}`} data-testid="assistant-result">
      {card.image && <img src={card.image} alt="" className="h-40 w-full object-cover" loading="lazy" />}
      <div className="p-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">{[card.offerLabel, card.typeLabel].filter(Boolean).join(' · ')}</p>
        {category && <span className="mt-1 inline-block rounded-full bg-gold/15 px-2 py-0.5 text-xs text-slate-800">{category}</span>}
        <h3 id={`result-${card.id}`} className="text-lg font-semibold text-slate-900">{card.title}</h3>
        {card.price
          ? <p className="mt-1 text-base font-semibold text-brand-blue">{card.price.label} : {card.price.value}</p>
          : <p className="mt-1 text-sm text-slate-500">Prix non renseigné sur l’annonce</p>}
        {card.honoraires && <p className="text-xs text-slate-600">{card.honoraires.label} : {card.honoraires.value}</p>}
        {card.location && <p className="text-sm text-slate-600">{card.location}</p>}
        {card.features.length > 0 && <p className="text-sm text-slate-600">{card.features.join(' · ')}</p>}
        {card.summary && <p className="mt-2 text-sm text-slate-700">{card.summary}</p>}
        <List title="Critères satisfaits" items={card.satisfied} tone="text-emerald-800" marker="✓" />
        <List title="Critères non satisfaits" items={card.unmet} tone="text-red-800" marker="✗" />
        <List title="À vérifier" items={card.toVerify} tone="text-amber-800" marker="?" />
        <List title="Points de comparaison" items={card.tradeoffs} tone="text-slate-800" marker="•" />
        {card.isLodging && <p className="mt-2 text-xs text-slate-500">Disponibilités aux dates souhaitées confirmées uniquement lors de la réservation.</p>}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link href={listingHref(card)} className="rounded-full bg-brand-blue px-4 py-2 text-sm font-semibold text-white">Voir la fiche</Link>
          <Link href={listingHref(card)} className="rounded-full border border-brand-blue px-4 py-2 text-sm text-brand-blue">
            {card.isLodging ? 'Vérifier les dates et réserver' : 'Demander une visite'}
          </Link>
          <a href={advisorWhatsAppUrl(card.title)} target="_blank" rel="noopener noreferrer" className="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700">Parler à un conseiller</a>
          {onToggleCompare && (
            <label className="ml-auto flex min-h-[44px] items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={selected} disabled={!selected && compareDisabled} onChange={() => onToggleCompare(card.id)} /> Comparer
            </label>
          )}
        </div>
      </div>
    </article>
  );
}

export function ComparisonPanel({ comparison }) {
  if (!comparison) return null;
  if (comparison.kind !== 'compared') {
    return <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900" data-testid="assistant-comparison">{comparison.message}</p>;
  }
  return (
    <section aria-label="Comparaison" className="space-y-4" data-testid="assistant-comparison">
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <caption className="sr-only">Comparaison des biens sélectionnés</caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 bg-white p-3 text-left text-slate-500">Critère</th>
              {comparison.columns.map((column) => <th key={column.id} scope="col" className="p-3 text-left font-semibold text-slate-900">{column.title}</th>)}
            </tr>
          </thead>
          <tbody>
            {comparison.rows.map((row) => (
              <tr key={row.key} className="border-t border-slate-100">
                <th scope="row" className="sticky left-0 bg-white p-3 text-left font-normal text-slate-600">{row.label}</th>
                {row.values.map((value, index) => <td key={comparison.columns[index]?.id || index} className="p-3 text-slate-800">{value}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {comparison.columns.map((column) => (
          <article key={column.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="font-semibold text-slate-900">{column.title}</h3>
            {column.summary && <p className="mt-1 text-sm text-slate-700">{column.summary}</p>}
            <List title="Avantages" items={column.advantages} tone="text-emerald-800" marker="✓" />
            <List title="Limites" items={column.disadvantages} tone="text-red-800" marker="✗" />
            <List title="Non vérifié" items={column.unknowns} tone="text-amber-800" marker="?" />
            <Link href={listingHref({ id: column.id })} className="mt-3 inline-block text-sm text-brand-blue underline">Voir la fiche</Link>
          </article>
        ))}
      </div>
      {comparison.tradeoffSummary && <p className="text-sm text-slate-700">{comparison.tradeoffSummary}</p>}
      {comparison.conclusion && <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-800">{comparison.conclusion}</p>}
      {comparison.unavailableCount > 0 && <p className="text-xs text-slate-500">{comparison.unavailableCount} bien(s) sélectionné(s) ne sont plus publiés et ont été écartés.</p>}
    </section>
  );
}
