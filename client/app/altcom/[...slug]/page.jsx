import { buildMetadata } from '@/lib/seo';
import ClientPage from './ClientPage';

export const metadata = buildMetadata({ title: 'Page introuvable — Altcom', noIndex: true });

export default function Page() {
  return <ClientPage />;
}
