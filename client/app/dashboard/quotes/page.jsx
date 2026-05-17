import { buildMetadata } from '@/lib/seo';
import ManageQuotesPage from "@/lib/pages/dashboard/ManageQuotesPage";

export const metadata = buildMetadata({ title: 'Devis', noIndex: true });

export default function Page() {
  return <ManageQuotesPage />;
}
