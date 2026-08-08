import { buildMetadata } from '@/lib/seo';
import ApiPlatformPage from '@/lib/pages/dashboard/ApiPlatformPage';

export const metadata = buildMetadata({ title: 'Portail développeur', noIndex: true });

export default function Page() {
  return <ApiPlatformPage />;
}
