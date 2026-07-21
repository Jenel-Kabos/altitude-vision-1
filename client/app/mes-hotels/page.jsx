import { buildMetadata } from '@/lib/seo';
import MyHotelsPage from '@/lib/pages/dashboard/MyHotelsPage';

export const metadata = buildMetadata({ title: 'Mes hôtels', noIndex: true });

export default function Page() {
  return <MyHotelsPage />;
}
