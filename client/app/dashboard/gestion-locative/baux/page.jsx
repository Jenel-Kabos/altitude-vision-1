import { buildMetadata } from '@/lib/seo';
import RentalLeasesPage from '@/lib/pages/dashboard/RentalLeasesPage';

export const metadata = buildMetadata({ title: 'Baux', noIndex: true });

export default function Page() {
  return <RentalLeasesPage />;
}
