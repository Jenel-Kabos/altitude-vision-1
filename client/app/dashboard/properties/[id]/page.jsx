import { buildMetadata } from '@/lib/seo';
import PropertyAssetCockpitPage from "./ClientPage";

export const metadata = buildMetadata({ title: 'Cockpit patrimonial', noIndex: true });

export default function Page() {
  return <PropertyAssetCockpitPage />;
}
