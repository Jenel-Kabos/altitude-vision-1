import { buildMetadata } from '@/lib/seo';
import PropertyOwnersPage from '@/lib/pages/dashboard/PropertyOwnersPage';

export const metadata = buildMetadata({ title: 'Propriétaires', noIndex: true });

export default function Page() {
  return <PropertyOwnersPage />;
}
