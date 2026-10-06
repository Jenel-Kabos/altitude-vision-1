"use client";

import { useEffect, useState } from 'react';
import { RentalOperationProvider } from '../../context/RentalOperationContext';
import { INDIVIDUAL_RENTAL_CONTEXT } from '../../services/rentalRequestContext';
import { getIndividualSubscription } from '../../services/gestionLocativeService';

const BLOCKED_LABELS = {
  past_due: 'Paiement de l’abonnement en attente',
  cancelled: 'Abonnement individuel résilié',
};

export default function IndividualRentalRoute({ children, guardSubscription = true }) {
  const [state, setState] = useState(guardSubscription ? 'loading' : 'ready');
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!guardSubscription) return undefined;
    let active = true;
    getIndividualSubscription()
      .then((subscription) => {
        if (!active) return;
        setStatus(subscription?.status || null);
        setState(subscription && ['active', 'trialing'].includes(subscription.status) ? 'ready' : 'blocked');
      })
      .catch((error) => {
        if (!active) return;
        setState(error?.response?.status === 403 ? 'forbidden' : 'error');
      });
    return () => { active = false; };
  }, [guardSubscription]);

  let content = children;
  if (state === 'loading') content = <p role="status">Chargement de l’abonnement…</p>;
  if (state === 'blocked') content = (
    <section role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
      <h1 className="font-semibold">{BLOCKED_LABELS[status] || 'Aucun abonnement individuel'}</h1>
      <p className="mt-1 text-sm">Cette fonction est verrouillée. Vos biens et vos données locatives sont conservés.</p>
    </section>
  );
  if (state === 'forbidden') content = <p role="alert">Accès interdit à cette gestion locative.</p>;
  if (state === 'error') content = <p role="alert">Impossible de vérifier l’abonnement individuel.</p>;

  return <RentalOperationProvider value={INDIVIDUAL_RENTAL_CONTEXT}>{content}</RentalOperationProvider>;
}
