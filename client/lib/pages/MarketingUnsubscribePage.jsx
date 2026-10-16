'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { unsubscribeWithToken } from '../services/marketingPreferencesService';

export default function MarketingUnsubscribePage({ token }) {
  const [state, setState] = useState(token ? 'idle' : 'invalid');

  const confirm = async () => {
    setState('loading');
    try { await unsubscribeWithToken(token); setState('done'); }
    catch { setState('invalid'); }
  };

  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm space-y-4">
        <h1 className="text-xl font-semibold text-gray-900">Désinscription des e-mails promotionnels</h1>
        {state === 'done' ? (
          <p role="status" className="text-sm text-gray-700">
            Votre désinscription est enregistrée : vous ne recevrez plus d’e-mails promotionnels d’Altitude Vision.
            Les messages liés à votre compte (sécurité, réservations, paiements, contrats) restent envoyés.
          </p>
        ) : state === 'invalid' ? (
          <p role="alert" className="text-sm text-red-600">
            Ce lien de désinscription est invalide ou incomplet. Vous pouvez gérer vos préférences depuis votre compte
            ou écrire à support@altitudevision.agency.
          </p>
        ) : (
          <>
            <p className="text-sm text-gray-700">Confirmez-vous ne plus vouloir recevoir les offres et actualités d’Altitude Vision par e-mail ?</p>
            <button
              type="button"
              onClick={confirm}
              disabled={state === 'loading'}
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {state === 'loading' ? 'Enregistrement…' : 'Confirmer ma désinscription'}
            </button>
          </>
        )}
        <p className="text-xs text-gray-500">
          Vous pouvez à tout moment modifier vos choix depuis <Link href="/mon-compte" className="underline">votre compte</Link>.
        </p>
      </div>
    </main>
  );
}
