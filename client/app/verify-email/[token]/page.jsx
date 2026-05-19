import { buildMetadata } from '@/lib/seo';
import VerifyEmailPage from "@/lib/pages/VerifyEmailPage";

export const metadata = buildMetadata({ title: "Vérification de l'email", noIndex: true });

export default async function Page({ params }) {
  const { token } = await params;
  return <VerifyEmailPage token={token} />;
}
