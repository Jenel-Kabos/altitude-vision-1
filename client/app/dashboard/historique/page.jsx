import { buildMetadata } from '@/lib/seo';
import HistoriquePage from '@/lib/pages/dashboard/HistoriquePage';

export const metadata = buildMetadata({ title: "Historique des actions", noIndex: true });

export default function Page() {
  return <HistoriquePage />;
}
