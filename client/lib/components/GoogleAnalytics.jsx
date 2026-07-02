'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';

const GA_ID = 'G-17PK3B8NSQ';

function getConsent() {
  try { return localStorage.getItem('cookie_consent'); } catch (_) { return null; }
}

export default function GoogleAnalytics() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (getConsent() === 'accepted') setLoaded(true);

    const handler = () => {
      if (getConsent() === 'accepted') {
        setLoaded(true);
      } else {
        if (typeof window.gtag === 'function') {
          window.gtag('consent', 'update', { analytics_storage: 'denied' });
        }
        setLoaded(false);
      }
    };

    window.addEventListener('cookie_consent_change', handler);
    return () => window.removeEventListener('cookie_consent_change', handler);
  }, []);

  if (!loaded) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('consent', 'default', { analytics_storage: 'granted' });
          gtag('config', '${GA_ID}');
        `}
      </Script>
    </>
  );
}
