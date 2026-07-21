import { buildMetadata } from '@/lib/seo';
import HotelModerationPage from "@/lib/pages/dashboard/HotelModerationPage";

export const metadata = buildMetadata({ title: 'Modération Hôtellerie', noIndex: true });

export default function Page() {
  return <HotelModerationPage />;
}
