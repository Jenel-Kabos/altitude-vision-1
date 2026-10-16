import { buildMetadata } from '@/lib/seo';
import FinancialKycReviewPage from '@/lib/pages/dashboard/FinancialKycReviewPage';
export const metadata = buildMetadata({ title: 'Vérifications d’identité — Dashboard', noIndex: true });
export default function Page() { return <FinancialKycReviewPage/>; }
