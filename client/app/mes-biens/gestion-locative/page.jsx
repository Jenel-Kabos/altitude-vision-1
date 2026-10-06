import { buildMetadata } from '@/lib/seo';
import IndividualRentalManagementPage from '@/lib/pages/dashboard/IndividualRentalManagementPage';
import IndividualRentalRoute from '@/lib/components/dashboard/IndividualRentalRoute';

export const metadata = buildMetadata({ title: 'Gestion locative individuelle', noIndex: true });

export default function Page() {
  return <IndividualRentalRoute guardSubscription={false}><IndividualRentalManagementPage /></IndividualRentalRoute>;
}
