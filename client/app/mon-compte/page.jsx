import { buildMetadata } from '@/lib/seo';
import AccountPage from "@/lib/pages/AccountPage";

export const metadata = buildMetadata({ title: 'Mon compte', noIndex: true });

export default function Page() {
  return <AccountPage />;
}
