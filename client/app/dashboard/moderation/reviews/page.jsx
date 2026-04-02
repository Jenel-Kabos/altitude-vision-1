import { buildMetadata } from '@/lib/seo';
import ReviewModerationPage from "@/lib/pages/dashboard/ReviewModerationPage";

export const metadata = buildMetadata({ title: 'Modération des avis', noIndex: true });

export default function Page() {
  return <ReviewModerationPage />;
}
