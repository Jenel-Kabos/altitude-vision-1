import { buildMetadata } from '@/lib/seo';
import MyPropertiesPage from "@/lib/pages/dashboard/MyPropertiesPage";

export const metadata = buildMetadata({ title: 'Mes biens', noIndex: true });

export default function Page() {
  return <MyPropertiesPage />;
}
