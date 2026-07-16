import { buildMetadata } from '@/lib/seo';
import { Suspense } from 'react';
import MessagesPage from "@/lib/pages/MessagesPage";

export const metadata = buildMetadata({ title: 'Mes messages', noIndex: true });

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-64 animate-pulse rounded-2xl bg-gray-100" aria-label="Chargement de la messagerie" />}>
      <MessagesPage />
    </Suspense>
  );
}
