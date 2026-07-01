import { buildMetadata } from '@/lib/seo';
import DocumentsPage from '@/lib/pages/dashboard/DocumentsPage';

export const metadata = buildMetadata({ title: 'Documents', noIndex: true });

export default function Page() {
  return <DocumentsPage />;
}
