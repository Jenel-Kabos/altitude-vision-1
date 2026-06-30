import { buildMetadata } from '@/lib/seo';
import NotFoundPage from "@/lib/pages/NotFoundPage";

export const metadata = buildMetadata({ title: 'Page introuvable — Événementiel', noIndex: true });

export default function Page() {
  return <NotFoundPage />;
}
