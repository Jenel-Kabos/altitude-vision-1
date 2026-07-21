import { buildMetadata } from '@/lib/seo';
import MyPaymentsPage from '@/lib/pages/dashboard/MyPaymentsPage';

export const metadata = buildMetadata({ title: 'Mes paiements', noIndex: true });

export default function Page() {
  return <MyPaymentsPage />;
}
