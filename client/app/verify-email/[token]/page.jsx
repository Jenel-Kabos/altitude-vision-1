import { buildMetadata } from '@/lib/seo';
import VerifyEmailPage from "@/lib/pages/VerifyEmailPage";

export const metadata = buildMetadata({ title: "Vérification de l'email", noIndex: true });

export default function Page({ params }) {
  return <VerifyEmailPage token={params.token} />;
}
