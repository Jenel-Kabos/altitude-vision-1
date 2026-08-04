'use client';
import dynamic from 'next/dynamic';

const PropertyAssetCockpitPage = dynamic(
  () => import("@/lib/pages/dashboard/PropertyAssetCockpitPage"),
  { ssr: false }
);

export default PropertyAssetCockpitPage;
