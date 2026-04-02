import { buildMetadata } from '@/lib/seo';
import ActiveUsersPage from "@/lib/pages/ActiveUsersPage";

export const metadata = buildMetadata({ title: 'Utilisateurs actifs', noIndex: true });

export default function Page() {
  return <ActiveUsersPage />;
}
