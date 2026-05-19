import { Suspense } from 'react';
import { buildMetadata } from '@/lib/seo';
import VerifyEmailPendingPage from "@/lib/pages/VerifyEmailPendingPage";

export const metadata = buildMetadata({ title: "Vérification de l'email", noIndex: true });

export default function Page() {
  return (
    <Suspense>
      <VerifyEmailPendingPage />
    </Suspense>
  );
}
