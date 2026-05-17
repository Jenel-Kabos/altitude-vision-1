import { buildMetadata } from '@/lib/seo';
import ManageEventsPage from "@/lib/pages/dashboard/ManageEventsPage";

export const metadata = buildMetadata({ title: 'Événements', noIndex: true });

export default function Page() {
  return <ManageEventsPage />;
}
