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
      {!noHeaderFooter && <Header />}
      {children}
      {!noHeaderFooter && <Footer />}
    </>
  );
}
