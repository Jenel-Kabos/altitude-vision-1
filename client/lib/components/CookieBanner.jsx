'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Cookie } from 'lucide-react';
import { useCookieConsent } from '@/lib/hooks/useCookieConsent';
import styles from './CookieBanner.module.css';

export default function CookieBanner() {
  const { consent, accept, refuse } = useCookieConsent();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(consent === null);
  }, [consent]);

  if (!visible) return null;

  return (
    <div
      className={styles.banner}
      role="dialog"
      aria-label="Vos préférences de confidentialité"
      aria-describedby="cookie-consent-description"
      aria-live="polite"
      data-cookie-layout="compact"
    >
      <div className={styles.inner}>
        <div className={styles.message}>
          <span className={styles.icon} aria-hidden="true"><Cookie size={18} /></span>
          <p id="cookie-consent-description">
            Nous utilisons des cookies analytiques pour mesurer l’audience et améliorer le site.{' '}
            <Link href="/politique-confidentialite#cookies" aria-label="Consulter la politique de confidentialité">
              En savoir plus
            </Link>
          </p>
        </div>
        <div className={styles.actions}>
          <button className={styles.refuse} onClick={refuse} type="button" aria-label="Refuser les cookies analytiques">
            Refuser
          </button>
          <button className={styles.accept} onClick={accept} type="button" aria-label="Accepter les cookies analytiques">
            Accepter
          </button>
        </div>
      </div>
    </div>
  );
}
