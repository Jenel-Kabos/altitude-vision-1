import { buildMetadata } from '@/lib/seo';
import AdminMessagesPage from "@/lib/pages/dashboard/AdminMessagesPage";

export const metadata = buildMetadata({ title: 'Messages Admin', noIndex: true });

export default function Page() {
  return <AdminMessagesPage />;
}
