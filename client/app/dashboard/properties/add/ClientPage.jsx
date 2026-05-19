'use client';
import dynamic from 'next/dynamic';

const AddPropertyPage = dynamic(
  () => import("@/lib/pages/dashboard/AddPropertyPage"),
  { ssr: false }
);

export default AddPropertyPage;
