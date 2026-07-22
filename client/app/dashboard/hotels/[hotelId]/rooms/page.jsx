import { buildMetadata } from '@/lib/seo';
import RoomsPage from '@/lib/pages/dashboard/RoomsPage';

export const metadata = buildMetadata({ title: 'Chambres', noIndex: true });

export default function Page() {
  return <RoomsPage />;
}
