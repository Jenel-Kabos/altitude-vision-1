import { buildMetadata } from '@/lib/seo';
import HomePage from "@/lib/pages/HomePage";

export const metadata = buildMetadata({
  title: "Immobilier, Événements & Communication à Brazzaville",
  description: "Altitude-Vision — Trouvez votre bien immobilier, organisez vos événements et boostez votre communication à Brazzaville, Congo.",
  url: "/",
});

export default function Page() {
  return <HomePage />;
}
