import { buildMetadata } from '@/lib/seo';
import ResetPasswordPage from "@/lib/pages/ResetPasswordPage";

export const metadata = buildMetadata({ title: 'Réinitialisation du mot de passe', noIndex: true });

export default async function Page({ params }) {
  const { token } = await params;
  return <ResetPasswordPage token={token} />;
}
