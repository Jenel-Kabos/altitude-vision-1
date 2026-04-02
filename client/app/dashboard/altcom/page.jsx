import { buildMetadata } from '@/lib/seo';
import ManageAltcomPage from "@/lib/pages/dashboard/ManageAltcomPage";

export const metadata = buildMetadata({ title: 'Altcom — Dashboard', noIndex: true });

export default function Page() {
  return <ManageAltcomPage />;
}
