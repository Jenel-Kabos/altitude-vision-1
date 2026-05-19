import { buildMetadata } from '@/lib/seo';
import AddPropertyPage from "./ClientPage";

export const metadata = buildMetadata({ title: 'Ajouter un bien', noIndex: true });

export default function Page() {
  return <AddPropertyPage />;
}
