import { buildMetadata } from '@/lib/seo';
import AccommodationModerationPage from "@/lib/pages/dashboard/AccommodationModerationPage";

export const metadata = buildMetadata({ title: 'Modération Hébergement', noIndex: true });

export default function Page() {
  return <AccommodationModerationPage />;
}
