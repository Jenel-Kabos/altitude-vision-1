"use client";

import { usePathname } from 'next/navigation';
import Header from '@/lib/components/layout/Header';
import Footer from '@/lib/components/layout/Footer';

export default function ClientLayout({ children }) {
  const pathname = usePathname();
  const noHeaderFooter =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/admin');

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-semibold focus:bg-white focus:text-gray-900 focus:shadow-lg"
      >
        Aller au contenu principal
      </a>
      {!noHeaderFooter && <Header />}
      <main id="main-content">{children}</main>
      {!noHeaderFooter && <Footer />}
    </>
  );
}
