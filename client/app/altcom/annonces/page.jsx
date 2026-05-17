import { buildMetadata } from '@/lib/seo';
import AltcomAnnonces from "@/lib/pages/altcom/AltcomAnnonces";

export const metadata = buildMetadata({
  title: "Actualités & Projets — Altcom",
  description: "Retrouvez les derniers projets et réalisations d'Altcom, agence de communication à Brazzaville.",
  url: "/altcom/annonces",
});

export default function Page() {
  return <AltcomAnnonces />;
}
