'use client';
import dynamic from 'next/dynamic';

const MyAccommodationsPage = dynamic(
  () => import("@/lib/pages/dashboard/MyAccommodationsPage"),
  { ssr: false }
);

export default MyAccommodationsPage;
