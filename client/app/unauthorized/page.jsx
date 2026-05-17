import { buildMetadata } from '@/lib/seo';
import UnauthorizedPage from "@/lib/pages/UnauthorizedPage";

export const metadata = buildMetadata({ title: 'Accès non autorisé', noIndex: true });

export default function Page() {
  return <UnauthorizedPage />;
}
