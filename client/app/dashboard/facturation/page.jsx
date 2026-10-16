import { buildMetadata } from '@/lib/seo';
import BillingAdministrationPage from '@/lib/pages/dashboard/BillingAdministrationPage';
export const metadata = buildMetadata({ title: 'Facturation — Dashboard', noIndex: true });
export default function Page() { return <BillingAdministrationPage/>; }
