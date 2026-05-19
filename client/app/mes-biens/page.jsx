import { buildMetadata } from '@/lib/seo';
import OwnerPropertyManagement from "./ClientPage";

export const metadata = buildMetadata({ title: 'Mes biens', noIndex: true });

export default function Page() {
  return <OwnerPropertyManagement />;
}
