import { buildMetadata } from '@/lib/seo';
import ManagePropertiesPage from '../properties/ClientPage';

export const metadata = buildMetadata({ title: 'Gestion des ventes', noIndex: true });

export default function Page() {
  return <ManagePropertiesPage section="vente" />;
}
