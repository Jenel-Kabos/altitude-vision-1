import { buildMetadata } from '@/lib/seo';
import AdminPropertyList from "@/lib/pages/dashboard/AdminPropertyList";

export const metadata = buildMetadata({ title: 'Biens Admin', noIndex: true });

export default function Page() {
  return <AdminPropertyList />;
}
