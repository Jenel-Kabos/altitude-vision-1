import { buildMetadata } from '@/lib/seo';
import MyAccommodationsPage from "./ClientPage";

export const metadata = buildMetadata({ title: 'Mes hébergements', noIndex: true });

export default function Page() {
  return <MyAccommodationsPage />;
}
