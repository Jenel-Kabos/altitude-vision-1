import { buildMetadata } from '@/lib/seo';
import GestionLocativePage from '@/lib/pages/dashboard/GestionLocativePage';

export const metadata = buildMetadata({ title: 'Gestion Locative', noIndex: true });

export default function Page() {
  return <GestionLocativePage />;
}
