import { buildMetadata } from '@/lib/seo';
import ForgotPasswordPage from "@/lib/pages/ForgotPasswordPage";

export const metadata = buildMetadata({ title: 'Mot de passe oublié', noIndex: true });

export default function Page() {
  return <ForgotPasswordPage />;
}
