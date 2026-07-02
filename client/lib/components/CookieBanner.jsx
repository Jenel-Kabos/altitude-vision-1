'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Cookie } from 'lucide-react';
import { useCookieConsent } from '@/lib/hooks/useCookieConsent';

const GOLD = '#C8960C';
const INK  = '#1A1612';

export default function CookieBanner() {
  const { consent, accept, refuse } = useCookieConsent();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(consent === null);
  }, [consent]);

  if (!visible) return null;

  return (
    <>
      <style>{`
        @keyframes av-cookie-slide {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        .av-cookie-banner {
          position: fixed;
          bottom: 0; left: 0; right: 0;
          z-index: 9999;
          animation: av-cookie-slide 0.35s cubic-bezier(0.22,1,0.36,1) both;
        }
        .av-cookie-inner {
          background: #fff;
          border-top: 1px solid rgba(17,24,39,0.10);
          box-shadow: 0 -8px 32px rgba(17,24,39,0.12);
          padding: clamp(14px,2vw,22px) clamp(16px,4vw,48px);
          display: flex;
          align-items: center;
          gap: clamp(12px,2vw,28px);
          flex-wrap: wrap;
        }
        .av-cookie-icon-wrap {
          flex-shrink: 0;
          width: 44px; height: 44px;
          border-radius: 12px;
          background: ${GOLD}18;
          display: flex; align-items: center; justify-content: center;
        }
        .av-cookie-text {
          flex: 1; min-width: 200px;
          font-family: 'DM Sans', sans-serif;
          font-size: clamp(0.78rem,1.1vw,0.92rem);
          color: #374151; font-weight: 300; line-height: 1.6; margin: 0;
        }
        .av-cookie-text a { color: ${GOLD}; font-weight: 500; text-decoration: underline; text-underline-offset: 2px; }
        .av-cookie-actions { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
        .av-cookie-btn-accept {
          font-family: 'DM Sans', sans-serif; font-size: 0.85rem; font-weight: 500;
          color: #fff; background: ${GOLD}; border: none; border-radius: 8px;
          padding: 10px 20px; cursor: pointer; white-space: nowrap;
          transition: background 0.2s, transform 0.15s;
        }
        .av-cookie-btn-accept:hover { background: #a87a08; transform: translateY(-1px); }
        .av-cookie-btn-refuse {
          font-family: 'DM Sans', sans-serif; font-size: 0.85rem; font-weight: 400;
          color: #6B7280; background: transparent;
          border: 1px solid rgba(17,24,39,0.18); border-radius: 8px;
          padding: 10px 20px; cursor: pointer; white-space: nowrap;
          transition: border-color 0.2s, color 0.2s, transform 0.15s;
        }
        .av-cookie-btn-refuse:hover { border-color: rgba(17,24,39,0.4); color: ${INK}; transform: translateY(-1px); }
        @media (max-width: 600px) {
          .av-cookie-inner { flex-direction: column; align-items: flex-start; }
          .av-cookie-actions { width: 100%; }
          .av-cookie-btn-accept, .av-cookie-btn-refuse { flex: 1; text-align: center; }
        }
      `}</style>

      <div className="av-cookie-banner" role="dialog" aria-label="Consentement aux cookies" aria-live="polite">
        <div className="av-cookie-inner">
          <div className="av-cookie-icon-wrap" aria-hidden="true">
            <Cookie size={20} style={{ color: GOLD }} />
          </div>
          <p className="av-cookie-text">
            Nous utilisons des cookies analytiques (Google Analytics) pour mesurer l'audience de notre site
            et améliorer votre expérience.{' '}
            <Link href="/politique-confidentialite#cookies">En savoir plus</Link>
          </p>
          <div className="av-cookie-actions">
            <button className="av-cookie-btn-refuse" onClick={refuse} type="button">
              Refuser
            </button>
            <button className="av-cookie-btn-accept" onClick={accept} type="button">
              Tout accepter
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
