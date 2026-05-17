import { buildMetadata } from '@/lib/seo';
import ManagePropertiesPage from "@/lib/pages/dashboard/ManagePropertiesPage";

export const metadata = buildMetadata({ title: 'Gestion des biens', noIndex: true });

export default function Page() {
  return <ManagePropertiesPage />;
}
