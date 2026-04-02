import { buildMetadata } from '@/lib/seo';
import UsersPanel from "@/lib/pages/dashboard/UsersPanel";

export const metadata = buildMetadata({ title: 'Utilisateurs', noIndex: true });

export default function Page() {
  return <UsersPanel />;
}
