'use client';
import dynamic from 'next/dynamic';

const NotFoundPage = dynamic(
  () => import('@/lib/pages/NotFoundPage'),
  { ssr: false }
);

export default function ClientPage() {
  return <NotFoundPage />;
}
