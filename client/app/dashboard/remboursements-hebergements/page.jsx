import { buildMetadata } from '@/lib/seo';
import AccommodationRefundOperationsPage from '@/lib/pages/dashboard/AccommodationRefundOperationsPage';
export const metadata = buildMetadata({ title: 'Remboursements hébergements — Dashboard', noIndex: true });
export default function Page() { return <AccommodationRefundOperationsPage/>; }
