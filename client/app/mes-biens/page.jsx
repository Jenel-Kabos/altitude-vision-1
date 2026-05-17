import { buildMetadata } from '@/lib/seo';
import OwnerPropertyManagement from "@/lib/pages/dashboard/OwnerPropertyManagement";

export const metadata = buildMetadata({ title: 'Mes biens', noIndex: true });

export default function Page() {
  return <OwnerPropertyManagement />;
}
