import { buildMetadata } from '@/lib/seo';
import FavoritesPage from "@/lib/pages/FavoritesPage";

export const metadata = buildMetadata({ title: 'Mes favoris', noIndex: true });

export default function Page() {
  return <FavoritesPage />;
}
