import { buildMetadata } from '@/lib/seo';
import RentalContractRegularizationPage from '@/lib/pages/dashboard/RentalContractRegularizationPage';

export const metadata = buildMetadata({ title: 'Régularisation des contrats historiques', noIndex: true });
export default function Page() { return <RentalContractRegularizationPage />; }
