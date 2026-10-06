"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Building2, Loader2 } from 'lucide-react';
import {
  enableRentalManagement,
  getIndividualRentalManagement,
  getIndividualRentalManagementStats,
  getIndividualSubscription,
} from '../../services/gestionLocativeService';
import { INDIVIDUAL_RENTAL_CONTEXT } from '../../services/rentalRequestContext';

const NAVIGATION = [
  ['Dossiers', ''], ['Baux', '/baux'], ['Locataires', '/locataires'], ['Paiements', '/paiements'],
  ['Préavis', '/preavis'], ['Maintenance', '/maintenance'], ['Documents', '/documents'],
];

const subscriptionLabel = (subscription) => {
  if (!subscription) return 'Aucun abonnement individuel';
  if (subscription.status === 'past_due') return 'Paiement de l’abonnement en attente';
  if (subscription.status === 'cancelled') return 'Abonnement individuel résilié';
  const plan = `${subscription.plan || 'individuel'}`.replace(/^./, (letter) => letter.toUpperCase());
  return subscription.status === 'trialing'
    ? `Abonnement ${plan} · période d’essai`
    : `Abonnement ${plan} · actif`;
};

export default function IndividualRentalManagementPage() {
  const [rentals, setRentals] = useState([]);
  const [stats, setStats] = useState({});
  const [state, setState] = useState('loading');
  const [subscription, setSubscription] = useState(undefined);
  const [propertyId, setPropertyId] = useState('');
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    let active = true;
    getIndividualSubscription().then((current) => {
      if (!active) return;
      setSubscription(current || null);
      if (!current || !['active', 'trialing'].includes(current.status)) {
        setState('forbidden');
        return;
      }
      Promise.all([
        getIndividualRentalManagement({ page: 1, limit: 25 }),
        getIndividualRentalManagementStats(),
      ]).then(([list, overview]) => {
        if (!active) return;
        setRentals(list.rentals || []);
        setStats(overview || {});
        setState('ready');
      }).catch((error) => {
        if (!active) return;
        setState(error?.response?.status === 403 ? 'forbidden' : 'error');
      });
    }).catch(() => { if (active) setState('error'); });
    return () => { active = false; };
  }, []);

  const activate = async (event) => {
    event.preventDefault();
    if (!propertyId.trim()) return;
    setActivating(true);
    try {
      await enableRentalManagement({ property: propertyId.trim() }, INDIVIDUAL_RENTAL_CONTEXT);
      const [list, overview] = await Promise.all([
        getIndividualRentalManagement({ page: 1, limit: 25 }), getIndividualRentalManagementStats(),
      ]);
      setRentals(list.rentals || []);
      setStats(overview || {});
      setPropertyId('');
    } finally { setActivating(false); }
  };

  return (
    <section className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Autogestion</p>
        <h1 className="text-3xl font-bold text-slate-900">Gestion locative individuelle</h1>
        <p className="mt-2 text-sm text-slate-600">Uniquement vos biens dont Property.tenant = null. Les biens gérés par une organisation restent dans leur espace dédié.</p>
      </header>

      {subscription !== undefined && (
        <p className={`rounded-lg px-4 py-3 text-sm ${subscription && ['active', 'trialing'].includes(subscription.status) ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>
          {subscriptionLabel(subscription)}
        </p>
      )}

      <nav aria-label="Gestion locative individuelle" className="flex flex-wrap gap-2">
        {NAVIGATION.map(([label, suffix]) => (
          <Link key={label} href={`/mes-biens/gestion-locative${suffix}`} className="rounded-lg border bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-emerald-400">
            {label}
          </Link>
        ))}
      </nav>

      {state === 'loading' && <div className="flex items-center gap-2 text-slate-600"><Loader2 className="animate-spin" /> Chargement…</div>}
      {state === 'forbidden' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
          <h2 className="font-semibold">Abonnement individuel requis</h2>
          <p className="mt-1 text-sm">Les fonctions payantes sont verrouillées, mais aucune donnée n’est supprimée ni rattachée à une organisation.</p>
        </div>
      )}
      {state === 'error' && <div className="flex items-center gap-2 rounded-xl bg-red-50 p-4 text-red-700"><AlertCircle /> Impossible de charger l’autogestion.</div>}
      {state === 'ready' && (
        <>
          <form onSubmit={activate} className="flex flex-wrap items-end gap-2 rounded-xl border bg-white p-4">
            <label className="flex-1 text-sm text-slate-700">Identifiant du bien à activer
              <input aria-label="Identifiant du bien à activer" value={propertyId} onChange={(event) => setPropertyId(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
            </label>
            <button disabled={activating || !propertyId.trim()} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Activer en gestion locative</button>
          </form>
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Biens sous gestion" value={stats.total || 0} />
            <Metric label="Vacants" value={stats.vacant || 0} />
            <Metric label="Occupés" value={stats.occupied || 0} />
          </div>
          {!rentals.length ? <p className="rounded-xl border border-dashed p-8 text-center text-slate-500">Aucun bien en autogestion</p> : (
            <div className="grid gap-4 lg:grid-cols-2">
              {rentals.map((rental) => (
                <article key={rental._id} className="rounded-xl border bg-white p-5 shadow-sm">
                  <div className="flex items-start gap-3"><Building2 className="text-emerald-600" />
                    <div><h2 className="font-semibold text-slate-900">{rental.property?.title || 'Bien locatif'}</h2>
                      <p className="text-sm text-slate-500">{rental.property?.address?.city || 'Adresse non renseignée'}</p>
                      <p className="mt-2 text-xs uppercase tracking-wide text-emerald-700">{rental.occupancyStatus || 'vacant'}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Metric({ label, value }) {
  return <div className="rounded-xl border bg-white p-4"><p className="text-2xl font-bold text-slate-900">{value}</p><p className="text-sm text-slate-500">{label}</p></div>;
}
