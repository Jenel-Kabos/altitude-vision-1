"use client";

// ALTIMMO-AI-INTEGRATION-01 (DeepSeek) — conseiller conversationnel Altimmo (comptes internes autorisés).
// Dialogue en flux, critères actifs tenus par le serveur, cartes d'annonces publiques, comparaison IA-03,
// annulation, reprise après rechargement et réinitialisation. Aucune action commerciale : la suite se fait
// sur la fiche officielle de l'annonce ou avec un conseiller Altitude Vision.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ComparisonPanel, advisorWhatsAppUrl, listingHref } from './AssistantResults';
import {
  cancelAdvisorTurn, classifyAdvisorError, getAdvisorConversation, resetAdvisorConversation, streamAdvisorTurn,
} from '../../services/altimmoAdvisorService';
import { advisorModeLabel, comparisonEnvelope, replacesCards, toAdvisorCards, turnOriginLabel } from '../../utils/advisorViewModel';
import { toComparisonView } from '../../utils/assistantViewModel';

const MAX_TEXT = 1000;
const STORAGE_KEY = 'altimmo.advisor.conversation';
const randomId = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`);
const storedConversation = () => {
  try { const value = window.sessionStorage.getItem(STORAGE_KEY); if (value && /^[A-Za-z0-9-]{8,64}$/.test(value)) return value; } catch { /* stockage indisponible */ }
  const id = randomId();
  try { window.sessionStorage.setItem(STORAGE_KEY, id); } catch { /* stockage indisponible */ }
  return id;
};

function List({ title, items, tone, marker }) {
  if (!items.length) return null;
  return (
    <div className="mt-2">
      <p className={`text-xs font-semibold ${tone}`}>{title}</p>
      <ul className="text-xs text-slate-700">{items.map((item) => <li key={item}>{marker} {item}</li>)}</ul>
    </div>
  );
}

export function AdvisorListingCard({ card, selected, onToggleCompare, compareDisabled }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" data-testid="advisor-card" aria-labelledby={`advisor-${card.id}`}>
      {card.image && <img src={card.image} alt="" className="h-36 w-full object-cover" loading="lazy" />}
      <div className="p-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">{[card.offerLabel, card.typeLabel].filter(Boolean).join(' · ')}</p>
        {card.isLodging && <span className="mt-1 inline-block rounded-full bg-gold/15 px-2 py-0.5 text-xs text-slate-800">Hébergement annoncé</span>}
        <h3 id={`advisor-${card.id}`} className="text-base font-semibold text-slate-900">{card.title}</h3>
        {card.price ? <p className="text-sm font-semibold text-brand-blue">{card.price.label} : {card.price.value}</p> : <p className="text-sm text-slate-500">Prix non renseigné sur l’annonce</p>}
        {card.location && <p className="text-sm text-slate-600">{card.location}</p>}
        {card.features.length > 0 && <p className="text-sm text-slate-600">{card.features.join(' · ')}</p>}
        <List title="Atouts" items={card.strengths} tone="text-emerald-800" marker="✓" />
        <List title="Limites" items={card.limits} tone="text-red-800" marker="✗" />
        <List title="À vérifier" items={card.toVerify} tone="text-amber-800" marker="?" />
        {card.isLodging && <p className="mt-2 text-xs text-slate-500">Disponibilités aux dates souhaitées non vérifiées par le conseiller : elles sont confirmées uniquement lors de la réservation.</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link href={listingHref(card)} className="rounded-full bg-brand-blue px-4 py-2 text-sm font-semibold text-white">Voir la fiche</Link>
          <a href={advisorWhatsAppUrl(card.title)} target="_blank" rel="noopener noreferrer" className="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700">Parler à un conseiller</a>
          {onToggleCompare && (
            <label className="ml-auto flex min-h-[44px] items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={selected} disabled={!selected && compareDisabled} onChange={() => onToggleCompare(card)} /> Comparer
            </label>
          )}
        </div>
      </div>
    </article>
  );
}

export default function AltimmoAdvisorChat({ status, onUseClassic }) {
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [criteria, setCriteria] = useState('');
  const [cards, setCards] = useState([]);
  const [comparison, setComparison] = useState(null);
  const [selected, setSelected] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(null);
  const [error, setError] = useState(null);
  const turn = useRef(null);
  const listRef = useRef(null);

  // Reprise : la conversation de l'onglet est relue côté serveur (mémoire validée uniquement).
  useEffect(() => {
    const id = storedConversation();
    setConversationId(id);
    getAdvisorConversation(id).then((data) => {
      if (!data) return;
      setMessages((data.messages || []).map((m, index) => ({ id: `r${index}`, role: m.role, text: m.content })));
      setCriteria(data.criteria || '');
      setCards(toAdvisorCards(data));
    }).catch(() => { /* nouvelle conversation */ });
  }, []);

  useEffect(() => { listRef.current?.scrollTo?.({ top: listRef.current.scrollHeight }); }, [messages]);
  useEffect(() => () => turn.current?.controller.abort(), []);

  const applyResult = useCallback((result) => {
    setCriteria(result.criteria || '');
    if (replacesCards(result)) setCards(toAdvisorCards(result));
    setComparison(result.comparison ? toComparisonView(comparisonEnvelope(result.comparison)) : null);
  }, []);

  const send = async (event) => {
    event?.preventDefault();
    const message = text.trim();
    if (!message || busy || !conversationId) return;
    const turnId = randomId().replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
    const controller = new AbortController();
    turn.current = { turnId, controller };
    const replyId = `a-${turnId}`;
    setMessages((current) => [...current, { id: `u-${turnId}`, role: 'user', text: message }, { id: replyId, role: 'assistant', text: '', pending: true }]);
    setText(''); setBusy(true); setError(null); setStep('Le conseiller réfléchit à votre demande');
    const patchReply = (patch) => setMessages((current) => current.map((m) => (m.id === replyId ? { ...m, ...patch } : m)));
    try {
      const result = await streamAdvisorTurn({
        conversationId, turnId, message, signal: controller.signal,
        onEvent: ({ event, data }) => {
          if (event === 'status') setStep(data.label);
          if (event === 'delta') setMessages((current) => current.map((m) => (m.id === replyId ? { ...m, text: m.text + data.text } : m)));
          if (event === 'facts' && data.cards) setCards(toAdvisorCards(data));
        },
      });
      // La réponse finale fait foi (elle remplace un texte diffusé puis retiré par le garde de sortie).
      patchReply({ text: result.reply, pending: false, origin: turnOriginLabel(result.metrics) });
      applyResult(result);
      setSelected([]);
    } catch (caught) {
      const classified = classifyAdvisorError(caught);
      setMessages((current) => current.filter((m) => m.id !== replyId || m.text));
      patchReply({ pending: false, interrupted: true });
      setError(classified);
    } finally {
      turn.current = null; setBusy(false); setStep(null);
    }
  };

  const cancel = async () => {
    const current = turn.current;
    if (!current) return;
    await cancelAdvisorTurn(conversationId, current.turnId);
    current.controller.abort();
  };

  const reset = async () => {
    if (busy) await cancel();
    try { await resetAdvisorConversation(conversationId); } catch { /* conversation déjà expirée */ }
    const id = randomId();
    try { window.sessionStorage.setItem(STORAGE_KEY, id); } catch { /* stockage indisponible */ }
    setConversationId(id); setMessages([]); setCriteria(''); setCards([]); setComparison(null); setSelected([]); setError(null);
  };

  const toggleCompare = (card) => setSelected((current) => (current.includes(card.id) ? current.filter((id) => id !== card.id) : [...current, card.id].slice(0, 5)));
  const compareSelected = () => {
    const positions = selected.map((id) => cards.findIndex((card) => card.id === id) + 1).filter((n) => n > 0).sort((a, b) => a - b);
    const ordinals = ['premier', 'deuxième', 'troisième', 'quatrième', 'cinquième'];
    setText(`Compare le ${positions.map((n) => ordinals[n - 1]).join(' et le ')}.`);
  };

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6" aria-label="Conseiller immobilier Altimmo" data-testid="advisor-chat">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-slate-900">Conseiller immobilier Altimmo</h1>
          <p className="text-sm text-slate-600">Décrivez votre projet : je recherche et compare les annonces publiées. Je ne réserve, ne paie et ne transmets aucune coordonnée.</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs text-amber-900" data-testid="advisor-mode">Accès interne · {advisorModeLabel(status?.mode)}</span>
          {onUseClassic && <button type="button" onClick={onUseClassic} className="text-xs text-brand-blue underline">Utiliser la recherche guidée</button>}
        </div>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700" data-testid="advisor-criteria">
        <span className="font-semibold">Critères retenus : </span>{criteria || 'aucun pour le moment'}
      </div>

      <div ref={listRef} className="max-h-[50vh] space-y-3 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4" aria-live="polite" data-testid="advisor-messages">
        {messages.length === 0 && <p className="text-sm text-slate-500">Par exemple : « Je cherche une maison à louer à Brazzaville entre 100 000 et 250 000 FCFA. »</p>}
        {messages.map((m) => (
          <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div className={`max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2 text-sm ${m.role === 'user' ? 'bg-brand-blue text-white' : 'bg-slate-100 text-slate-900'}`} data-testid={`advisor-message-${m.role}`}>
              {m.text || (m.pending ? '…' : '')}
              {m.origin && <p className="mt-1 text-[11px] text-slate-500">Réponse : {m.origin}</p>}
              {m.interrupted && <p className="mt-1 text-[11px] text-amber-700">Réponse interrompue</p>}
            </div>
          </div>
        ))}
      </div>

      {step && <p role="status" className="text-xs text-slate-500" data-testid="advisor-step">{step}…</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800" data-testid={`advisor-error-${error.kind}`}>{error.message}</p>}

      <form onSubmit={send} className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="advisor-input" className="sr-only">Votre message</label>
        <textarea id="advisor-input" value={text} maxLength={MAX_TEXT} rows={2} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) send(e); }}
          className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="Votre message au conseiller" disabled={!conversationId} />
        <div className="flex gap-2">
          {busy
            ? <button type="button" onClick={cancel} className="rounded-full border border-red-300 px-4 py-2 text-sm text-red-700">Annuler</button>
            : <button type="submit" disabled={!text.trim()} className="rounded-full bg-gold px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">Envoyer</button>}
          <button type="button" onClick={reset} className="rounded-full border px-4 py-2 text-sm">Nouvelle conversation</button>
        </div>
      </form>

      {cards.length > 0 && (
        <section aria-label="Annonces proposées" className="space-y-3">
          <h2 className="font-semibold text-slate-900">Annonces publiées présentées</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {cards.map((card) => <AdvisorListingCard key={card.id} card={card} selected={selected.includes(card.id)} onToggleCompare={toggleCompare} compareDisabled={selected.length >= 5} />)}
          </div>
          {selected.length >= 2 && <button type="button" onClick={compareSelected} disabled={busy} className="rounded-full bg-brand-blue px-5 py-2 text-sm font-semibold text-white">Préparer la comparaison</button>}
        </section>
      )}

      <ComparisonPanel comparison={comparison} />

      <footer className="text-xs text-slate-500">
        <p>Réponses fondées sur les annonces publiées d’Altimmo. La proximité des services et les disponibilités ne sont pas vérifiées. Les messages sont traités par un fournisseur externe uniquement lorsque le mode DeepSeek est actif : n’y indiquez aucune donnée personnelle.</p>
      </footer>
    </section>
  );
}
