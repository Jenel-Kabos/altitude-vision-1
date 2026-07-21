import { buildMetadata } from '@/lib/seo';
import RentalNoticesPage from '@/lib/pages/dashboard/RentalNoticesPage';

export const metadata = buildMetadata({ title: 'Préavis', noIndex: true });

export default function Page() {
  return <RentalNoticesPage />;
}
