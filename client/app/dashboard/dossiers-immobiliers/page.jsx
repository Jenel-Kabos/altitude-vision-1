import { buildMetadata } from '@/lib/seo';
import RealEstateApplicationsPage from '@/lib/pages/dashboard/RealEstateApplicationsPage';
export const metadata = buildMetadata({ title: 'Offres et candidatures', noIndex: true });
export default function Page() { return <RealEstateApplicationsPage/>; }
