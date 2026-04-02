import { buildMetadata } from '@/lib/seo';
import DashboardHome from "@/lib/pages/dashboard/DashboardHome";

export const metadata = buildMetadata({ title: 'Dashboard', noIndex: true });

export default function Page() {
  return <DashboardHome />;
}
