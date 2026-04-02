import { buildMetadata } from '@/lib/seo';
import MessagesPage from "@/lib/pages/MessagesPage";

export const metadata = buildMetadata({ title: 'Mes messages', noIndex: true });

export default function Page() {
  return <MessagesPage />;
}
