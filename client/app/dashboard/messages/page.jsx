import { buildMetadata } from '@/lib/seo';
import InternalMessagingPage from "@/lib/pages/dashboard/InternalMessagingPage";

export const metadata = buildMetadata({ title: 'Messages', noIndex: true });

export default function Page() {
  return <InternalMessagingPage />;
}
