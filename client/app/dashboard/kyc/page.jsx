import { buildMetadata } from '@/lib/seo';
import FinancialKycOrganizationPage from '@/lib/pages/dashboard/FinancialKycOrganizationPage';
export const metadata = buildMetadata({ title: 'Dossiers KYC — Dashboard', noIndex: true });
export default function Page() { return <FinancialKycOrganizationPage/>; }
