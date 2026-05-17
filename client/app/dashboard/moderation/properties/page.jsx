import { buildMetadata } from '@/lib/seo';
import PropertyModerationPage from "@/lib/pages/dashboard/PropertyModerationPage";

export const metadata = buildMetadata({ title: 'Modération des biens', noIndex: true });

export default function Page() {
  return <PropertyModerationPage />;
}
