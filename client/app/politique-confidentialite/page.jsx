import { buildMetadata } from '@/lib/seo';
import PolitiqueConfidentialite from '@/lib/pages/PolitiqueConfidentialite';

export const metadata = buildMetadata({
  title: 'Politique de confidentialité — Altitude-Vision',
  description: 'Consultez la politique de confidentialité d\'Altitude-Vision : données collectées, droits, cookies et sécurité.',
  url: '/politique-confidentialite',
});

export default function Page() {
  return <PolitiqueConfidentialite />;
}
