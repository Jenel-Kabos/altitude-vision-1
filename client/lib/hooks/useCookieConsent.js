'use client';

import { useState, useEffect, useCallback } from 'react';

const KEY = 'cookie_consent';

export function useCookieConsent() {
  const [consent, setConsent] = useState(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored === 'accepted' || stored === 'refused') setConsent(stored);
    } catch (_) {}
  }, []);

  const accept = useCallback(() => {
    try { localStorage.setItem(KEY, 'accepted'); } catch (_) {}
    setConsent('accepted');
    window.dispatchEvent(new Event('cookie_consent_change'));
  }, []);

  const refuse = useCallback(() => {
    try { localStorage.setItem(KEY, 'refused'); } catch (_) {}
    setConsent('refused');
    window.dispatchEvent(new Event('cookie_consent_change'));
  }, []);

  const reset = useCallback(() => {
    try { localStorage.removeItem(KEY); } catch (_) {}
    setConsent(null);
    window.dispatchEvent(new Event('cookie_consent_change'));
  }, []);

  return { consent, accept, refuse, reset };
}
