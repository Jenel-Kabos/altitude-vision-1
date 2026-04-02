import { buildMetadata } from '@/lib/seo';
import RegisterPage from "@/lib/pages/RegisterPage";

export const metadata = buildMetadata({ title: 'Créer un compte', noIndex: true });

export default function Page() {
  return <RegisterPage />;
}
