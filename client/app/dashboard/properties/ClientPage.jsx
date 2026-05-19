'use client';
import dynamic from 'next/dynamic';

const ManagePropertiesPage = dynamic(
  () => import("@/lib/pages/dashboard/ManagePropertiesPage"),
  { ssr: false }
);

export default ManagePropertiesPage;
