'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { MARKETING_CHANNELS, OPERATIONAL_NOTICE } from '../constants/marketingConsent';
import { getMarketingPreferences, updateMarketingPreferences } from '../services/marketingPreferencesService';

// MARKETING-CONSENT-1 — Préférences de communications promotionnelles du
// compte connecté. Chaque changement est enregistré immédiatement côté
// serveur ; l'affichage reflète toujours l'état confirmé par le serveur.
export default function MarketingPreferencesPanel() {
  const [preferences, setPreferences] = useState(null);
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try { setPreferences(await getMarketingPreferences()); }
    catch { setError('Impossible de charger vos préférences de communication.'); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (channels, key) => {
    setSaving(key);
    setError('');
    try { setPreferences(await updateMarketingPreferences(channels)); }
    catch { setError('Votre choix n’a pas pu être enregistré. Réessayez.'); }
    finally { setSaving(null); }
  };

  const anyGranted = MARKETING_CHANNELS.some(({ key }) => preferences?.channels?.[key]?.granted);

  return (
    <section aria-labelledby="marketing-preferences-title" className="bg-white rounded-3xl border border-gray-100 shadow-sm px-7 py-6 space-y-4">
      <h2 id="marketing-preferences-title" className="font-bold text-gray-900 text-base">Communications et offres</h2>
      <p className="text-sm text-gray-600">Choisissez si Altitude Vision peut vous adresser des offres et actualités. Ces choix sont facultatifs et modifiables à tout moment.</p>
      {!preferences && !error && <p className="text-sm text-gray-500">Chargement…</p>}
      {preferences && MARKETING_CHANNELS.map((channel) => (
        <label key={channel.key} className="flex items-start justify-between gap-4 rounded-xl border border-gray-200 p-4">
          <span>
            <span className="block text-sm font-semibold text-gray-900">{channel.title}</span>
            <span className="block text-xs text-gray-500">{channel.description}</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            aria-label={channel.title}
            className="mt-1 h-5 w-5 accent-blue-600"
            checked={preferences.channels?.[channel.key]?.granted === true}
            disabled={Boolean(saving)}
            onChange={(event) => save({ [channel.key]: event.target.checked }, channel.key)}
          />
        </label>
      ))}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {preferences && anyGranted && (
        <button
          type="button"
          className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          disabled={Boolean(saving)}
          onClick={() => save(Object.fromEntries(MARKETING_CHANNELS.map(({ key }) => [key, false])), 'all')}
        >
          Retirer tous mes consentements
        </button>
      )}
      <p className="text-xs text-gray-500">{OPERATIONAL_NOTICE} Chaque e-mail promotionnel contient aussi un lien de désinscription.</p>
    </section>
  );
}
