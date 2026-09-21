import { buildMetadata } from '@/lib/seo';
import MembersPanel from "@/lib/pages/dashboard/MembersPanel";

export const metadata = buildMetadata({ title: 'Membres', noIndex: true });

export default function Page() {
  return <MembersPanel />;
}
