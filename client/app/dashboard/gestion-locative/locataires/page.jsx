import { buildMetadata } from '@/lib/seo';
import RentalTenantsPage from '@/lib/pages/dashboard/RentalTenantsPage';

export const metadata = buildMetadata({ title: 'Locataires', noIndex: true });

export default function Page() {
  return <RentalTenantsPage />;
}
