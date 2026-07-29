"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from '@/lib/utils/toast';
import { createAccommodationReservation, getAccommodationAvailability } from '../services/accommodationReservationService';

const money = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 });

export default function PublicAccommodationBookingForm({ accommodation, user }) {
  const router = useRouter(); const storageKey = `accommodation-booking:${accommodation._id}`;
  const [form, setForm] = useState({ checkInDate: '', checkOutDate: '', adults: 1, children: 0, specialRequests: '' });
  const [quote, setQuote] = useState(null); const [loading, setLoading] = useState(false); const [success, setSuccess] = useState(false);
  useEffect(() => { try { const saved = sessionStorage.getItem(storageKey); if (saved) setForm(JSON.parse(saved)); } catch {} }, [storageKey]);
  useEffect(() => { if (!form.checkInDate || !form.checkOutDate) { setQuote(null); return; } let active = true; getAccommodationAvailability(accommodation._id, { from: form.checkInDate, to: form.checkOutDate }).then((data) => { if (active) setQuote(data); }).catch(() => { if (active) setQuote(null); }); return () => { active = false; }; }, [accommodation._id, form.checkInDate, form.checkOutDate]);
  const guests = useMemo(() => Number(form.adults) + Number(form.children), [form.adults, form.children]);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    if (!quote?.available || !quote?.pricing) return toast.error('Choisissez une période disponible.');
    if (!user) { sessionStorage.setItem(storageKey, JSON.stringify(form)); router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`); return; }
    setLoading(true);
    try {
      await createAccommodationReservation({ accommodation: accommodation._id, checkInDate: form.checkInDate, checkOutDate: form.checkOutDate, adults: Number(form.adults), children: Number(form.children), guestCount: guests, specialRequests: form.specialRequests, source: 'public_web' });
      sessionStorage.removeItem(storageKey); setSuccess(true); toast.success('Votre demande a été envoyée.');
    } catch (error) { toast.error(error.response?.data?.message || 'Impossible d’envoyer la demande.'); }
    finally { setLoading(false); }
  };
  if (success) return <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><strong>Votre demande de réservation a été envoyée.</strong><p>Elle doit encore être confirmée.</p></div>;
  return <form onSubmit={submit} className="space-y-3" aria-label="Demander une réservation">
    <p className="font-semibold">Réserver cet hébergement</p>
    <div className="grid grid-cols-2 gap-2"><label className="text-xs">Arrivée<input className="mt-1 w-full rounded border p-2 text-slate-900" type="date" required value={form.checkInDate} onChange={(e) => update('checkInDate', e.target.value)} /></label><label className="text-xs">Départ<input className="mt-1 w-full rounded border p-2 text-slate-900" type="date" required value={form.checkOutDate} onChange={(e) => update('checkOutDate', e.target.value)} /></label></div>
    <div className="grid grid-cols-2 gap-2"><label className="text-xs">Adultes<input className="mt-1 w-full rounded border p-2 text-slate-900" type="number" min="1" max={accommodation.capacity?.maxAdults || 1} value={form.adults} onChange={(e) => update('adults', e.target.value)} /></label><label className="text-xs">Enfants<input className="mt-1 w-full rounded border p-2 text-slate-900" type="number" min="0" max={accommodation.capacity?.maxChildren || 0} value={form.children} onChange={(e) => update('children', e.target.value)} /></label></div>
    {quote?.pricing && <div className="rounded-lg bg-white/10 p-3 text-sm"><p>{quote.pricing.nights} nuit(s) × {money.format(quote.pricing.nightlyRate)}</p>{quote.pricing.cleaningFee > 0 && <p>Frais : {money.format(quote.pricing.cleaningFee)}</p>}<strong>Total : {money.format(quote.pricing.total)}</strong>{!quote.available && <p role="alert" className="text-red-300">Période indisponible</p>}</div>}
    <textarea className="w-full rounded border p-2 text-slate-900" maxLength="2000" placeholder="Demandes spéciales (facultatif)" value={form.specialRequests} onChange={(e) => update('specialRequests', e.target.value)} />
    <button disabled={loading || !quote?.available || guests > Number(accommodation.capacity?.maxAdults || 1) + Number(accommodation.capacity?.maxChildren || 0)} className="w-full rounded bg-amber-400 p-3 font-bold text-slate-950 disabled:opacity-50">{loading ? 'Envoi…' : user ? 'Envoyer la demande' : 'Se connecter et continuer'}</button>
    <p className="text-xs opacity-70">La demande reste en attente jusqu’à confirmation.</p>
  </form>;
}
