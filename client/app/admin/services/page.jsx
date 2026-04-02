import { buildMetadata } from '@/lib/seo';
import AdminServiceList from "@/lib/pages/dashboard/AdminServiceList";

export const metadata = buildMetadata({ title: 'Services Admin', noIndex: true });

export default function Page() {
  return <AdminServiceList />;
}
