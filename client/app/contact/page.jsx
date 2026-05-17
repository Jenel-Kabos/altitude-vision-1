import { buildMetadata } from '@/lib/seo';
import ContactPage from "@/lib/pages/ContactPage";

export const metadata = buildMetadata({
  title: "Contactez-nous",
  description: "Altitude-Vision — 24 Rue de la Mfoa, Poto-Poto, Brazzaville. Contactez notre équipe pour vos projets immobiliers, événementiels ou de communication.",
  url: "/contact",
});

export default function Page() {
  return <ContactPage />;
}
