'use client';
import dynamic from 'next/dynamic';

const MyPropertiesPage = dynamic(
  () => import("@/lib/pages/dashboard/MyPropertiesPage"),
  { ssr: false }
);

export default MyPropertiesPage;
