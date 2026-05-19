'use client';
import dynamic from 'next/dynamic';

const OwnerPropertyManagement = dynamic(
  () => import("@/lib/pages/dashboard/OwnerPropertyManagement"),
  { ssr: false }
);

export default OwnerPropertyManagement;
