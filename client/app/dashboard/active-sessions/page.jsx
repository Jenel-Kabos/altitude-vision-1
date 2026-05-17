import { buildMetadata } from '@/lib/seo';
import ActiveSessionsPage from "@/lib/pages/dashboard/ActiveSessionsPage";

export const metadata = buildMetadata({ title: 'Sessions actives', noIndex: true });

export default function Page() {
  return <ActiveSessionsPage />;
}
