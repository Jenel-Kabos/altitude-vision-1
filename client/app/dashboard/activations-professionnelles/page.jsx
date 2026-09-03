import { buildMetadata } from '@/lib/seo';
import TenantApplicationsPage from '@/lib/pages/dashboard/TenantApplicationsPage';

export const metadata = buildMetadata({ title: 'Demandes d’activation professionnelle', noIndex: true });

export default function Page() {
  return <TenantApplicationsPage />;
}
