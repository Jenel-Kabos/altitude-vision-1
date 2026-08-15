import { buildMetadata } from '@/lib/seo';
import ClientOverview from '@/lib/pages/dashboard/ClientOverview';

export const metadata = buildMetadata({ title: 'Mon espace', noIndex: true });

export default function Page() {
  return <ClientOverview />;
}
