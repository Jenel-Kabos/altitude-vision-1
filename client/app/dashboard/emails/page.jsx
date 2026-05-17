import { buildMetadata } from '@/lib/seo';
import ManageEmailsPage from "@/lib/pages/dashboard/ManageEmailsPage";

export const metadata = buildMetadata({ title: 'Emails', noIndex: true });

export default function Page() {
  return <ManageEmailsPage />;
}
