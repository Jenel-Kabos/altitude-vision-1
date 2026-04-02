import { buildMetadata } from '@/lib/seo';
import EditPropertyPage from "@/lib/pages/Properties/EditPropertyPage";

export const metadata = buildMetadata({ title: 'Modifier un bien', noIndex: true });

export default function Page() {
  return <EditPropertyPage />;
}
