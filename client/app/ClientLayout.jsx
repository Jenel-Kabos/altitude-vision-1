"use client";

import { usePathname } from 'next/navigation';
import Header from '@/lib/components/layout/Header';
import Footer from '@/lib/components/layout/Footer';
import CookieBanner from '@/lib/components/CookieBanner';
import { PublicSite } from '@/lib/components/public/PublicPrimitives';

export const isPublicSitePath = (pathname = '') => {
  if (pathname === '/immobilier/dossiers' || pathname.startsWith('/properties/submit') || pathname.startsWith('/properties/edit')) return false;
  return pathname === '/' ||
    pathname === '/home' ||
    pathname === '/contact' ||
    pathname === '/mentions-legales' ||
    pathname === '/politique-confidentialite' ||
    pathname === '/trouve-ta-commission' ||
    pathname === '/actualites' || pathname.startsWith('/actualites/') ||
    pathname === '/immobilier' || pathname.startsWith('/immobilier/') ||
    pathname === '/altimmo' || pathname.startsWith('/altimmo/') ||
    pathname === '/communication' || pathname.startsWith('/communication/') ||
    pathname === '/altcom' || pathname.startsWith('/altcom/') ||
    pathname === '/evenementiel' || pathname.startsWith('/evenementiel/') ||
    pathname === '/mila-events' || pathname.startsWith('/mila-events/') ||
    pathname === '/properties' || pathname.startsWith('/properties/');
};

export default function ClientLayout({ children }) {
  const pathname = usePathname();
  // UX-OWNER-1 — `OwnerDashboard.jsx` (shell partagé par /mes-biens, /mes-hotels,
  // /mes-hebergements) est un shell plein-écran autonome (sidebar + main,
  // min-h-screen) sans en-tête desktop propre, qui réserve `0px` d'offset pour
  // ce header global. Le header global est `position: fixed` (Header.jsx) avec
  // une hauteur responsive (58-76px) jamais compensée par ce shell : son
  // contenu (KPI, sidebar) se retrouvait donc visuellement masqué sous le
  // header sur toutes les largeurs ≥768px — bug réel reproduit. Même
  // traitement que /dashboard et /admin ci-dessus (shells autonomes avec leur
  // propre chrome, déjà exclus) : `/mon-espace-proprietaire` (sas transitoire,
  // même défaut, rayon d'impact moindre) est inclus par cohérence.
  const noHeaderFooter =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/mes-biens') ||
    pathname.startsWith('/mes-hotels') ||
    pathname.startsWith('/mes-hebergements') ||
    pathname.startsWith('/mon-espace-proprietaire');

  const content = (
    <>
      {!noHeaderFooter && <Header />}
      <main id="main-content">{children}</main>
      {!noHeaderFooter && <Footer />}
    </>
  );

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-semibold focus:bg-white focus:text-gray-900 focus:shadow-lg"
      >
        Aller au contenu principal
      </a>
      {isPublicSitePath(pathname) ? <PublicSite>{content}</PublicSite> : content}
      <CookieBanner />
    </>
  );
}
