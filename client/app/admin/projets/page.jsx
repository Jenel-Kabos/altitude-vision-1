import { buildMetadata } from '@/lib/seo';
import AdminProjectList from "@/lib/pages/dashboard/AdminProjectList";

export const metadata = buildMetadata({ title: 'Projets Admin', noIndex: true });

export default function Page() {
  return <AdminProjectList />;
}
