'use client';

import React from 'react';
import { MARKETING_CHANNELS, OPERATIONAL_NOTICE } from '../constants/marketingConsent';

// MARKETING-CONSENT-1 — Cases de consentement marketing facultatives, jamais
// précochées ; les laisser vides n'empêche pas l'inscription.
export default function MarketingConsentCheckboxes({ value, onChange, disabled = false }) {
  return (
    <fieldset className="space-y-2 rounded-xl border border-gray-200 p-4" disabled={disabled}>
      <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-gray-600">Communications (facultatif)</legend>
      {MARKETING_CHANNELS.map((channel) => (
        <label key={channel.key} className="flex cursor-pointer items-start gap-3 text-sm text-gray-700">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 flex-shrink-0 accent-blue-600"
            checked={value?.[channel.key] === true}
            onChange={(event) => onChange({ ...value, [channel.key]: event.target.checked })}
          />
          <span>{channel.consentLabel}</span>
        </label>
      ))}
      <p className="pt-1 text-xs text-gray-500">{OPERATIONAL_NOTICE} Modifiable à tout moment depuis votre compte.</p>
    </fieldset>
  );
}
