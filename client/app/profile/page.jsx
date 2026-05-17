import { buildMetadata } from '@/lib/seo';
import ProfilePage from "@/lib/pages/ProfilePage";

export const metadata = buildMetadata({ title: 'Mon profil', noIndex: true });

export default function Page() {
  return <ProfilePage />;
}
