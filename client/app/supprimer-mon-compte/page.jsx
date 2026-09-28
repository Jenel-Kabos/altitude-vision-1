import { buildMetadata } from '@/lib/seo';
import SupprimerMonCompte from '@/lib/pages/SupprimerMonCompte';

export const metadata = buildMetadata({
  title: 'Supprimer mon compte — Altimmo',
  description:
    "Procédure de suppression de compte Altimmo : depuis l'application, par email, données concernées et cas particuliers.",
  url: '/supprimer-mon-compte',
});

export default function Page() {
  return <SupprimerMonCompte />;
}
