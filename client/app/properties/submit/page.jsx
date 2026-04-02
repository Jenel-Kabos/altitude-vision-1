import { buildMetadata } from '@/lib/seo';
import SubmitPropertyPage from "@/lib/pages/Properties/SubmitPropertyPage";

export const metadata = buildMetadata({
  title: "Soumettre un Bien — Altimmo",
  description: "Publiez votre annonce immobilière sur Altimmo.",
  url: "/properties/submit",
});

export default function Page() {
  return <SubmitPropertyPage />;
}
