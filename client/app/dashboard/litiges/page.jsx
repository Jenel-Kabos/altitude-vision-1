import { buildMetadata } from '@/lib/seo';
import LitigesPage from '@/lib/pages/dashboard/LitigesPage';

export const metadata = buildMetadata({ title: 'Litiges', noIndex: true });

export default function Page() {
  return <LitigesPage />;
}
