import { buildMetadata } from '@/lib/seo';
import PlatformTenantsPage from '@/lib/pages/dashboard/PlatformTenantsPage';

export const metadata = buildMetadata({ title: 'Administration Multi-Tenant', noIndex: true });

export default function Page() {
  return <PlatformTenantsPage />;
}
