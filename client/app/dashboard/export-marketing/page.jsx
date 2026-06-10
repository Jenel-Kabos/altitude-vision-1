import { buildMetadata } from '@/lib/seo';
import ExportMarketingPage from '@/lib/pages/dashboard/ExportMarketingPage';

export const metadata = buildMetadata({ title: 'Export Marketing', noIndex: true });

export default function Page() {
  return <ExportMarketingPage />;
}
