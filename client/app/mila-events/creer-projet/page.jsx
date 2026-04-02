import { buildMetadata } from '@/lib/seo';
import CreateProjectPage from "@/lib/pages/CreateProjectPage";

export const metadata = buildMetadata({
  title: "Créer un Projet Événementiel — Mila Events",
  description: "Décrivez votre projet événementiel et obtenez un devis gratuit de Mila Events.",
  url: "/mila-events/creer-projet",
});

export default function Page() {
  return <CreateProjectPage />;
}
