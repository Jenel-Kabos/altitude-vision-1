import { buildMetadata } from '@/lib/seo';
import OrganizationAdminPage from '@/lib/pages/dashboard/OrganizationAdminPage';

export const metadata = buildMetadata({ title: 'Organisation', noIndex: true });

export default function Page() {
  return <OrganizationAdminPage />;
}
