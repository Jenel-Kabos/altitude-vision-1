import { buildMetadata } from '@/lib/seo';
import UsersContextPanel from '@/lib/pages/dashboard/UsersContextPanel';

export const metadata = buildMetadata({ title: 'Utilisateurs et membres', noIndex: true });

export default function Page() {
  return <UsersContextPanel />;
}
