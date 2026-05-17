import { buildMetadata } from '@/lib/seo';
import LeaveReviewPage from "@/lib/pages/LeaveReviewPage";

export const metadata = buildMetadata({ title: 'Laisser un avis', noIndex: true });

export default function Page() {
  return <LeaveReviewPage />;
}
