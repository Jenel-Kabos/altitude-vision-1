import { buildMetadata } from '@/lib/seo';
import HotelStaffAssignmentsPage from '@/lib/pages/dashboard/HotelStaffAssignmentsPage';

export const metadata = buildMetadata({ title: 'Personnel hôtelier — Dashboard', noIndex: true });

export default function Page() {
  return <HotelStaffAssignmentsPage />;
}
