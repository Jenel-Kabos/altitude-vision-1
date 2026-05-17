import { buildMetadata } from '@/lib/seo';
import LoginPage from "@/lib/pages/LoginPage";

export const metadata = buildMetadata({ title: 'Connexion', noIndex: true });

export default function Page() {
  return <LoginPage />;
}
