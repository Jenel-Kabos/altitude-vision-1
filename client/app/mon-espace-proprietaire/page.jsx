import { buildMetadata } from '@/lib/seo';
import OwnerContextLanding from '@/lib/pages/dashboard/OwnerContextLanding';

export const metadata = buildMetadata({ title: 'Mon espace propriétaire', noIndex: true });

export default function Page() {
  return <OwnerContextLanding />;
}
