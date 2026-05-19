import { buildMetadata } from '@/lib/seo';
import MyPropertiesPage from "./ClientPage";

export const metadata = buildMetadata({ title: 'Mes biens', noIndex: true });

export default function Page() {
  return <MyPropertiesPage />;
}
