import { buildMetadata } from '@/lib/seo';
import ResetPasswordPage from "@/lib/pages/ResetPasswordPage";

export const metadata = buildMetadata({ title: 'Réinitialisation du mot de passe', noIndex: true });

export default function Page({ params }) {
  return <ResetPasswordPage />;
}
