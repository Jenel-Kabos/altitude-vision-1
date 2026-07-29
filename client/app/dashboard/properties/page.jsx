import { buildMetadata } from '@/lib/seo';
import ManagePropertiesPage from "./ClientPage";

export const metadata = buildMetadata({ title: 'Gestion des biens', noIndex: true });

export default function Page() {
  return <ManagePropertiesPage readOnly />;
}
