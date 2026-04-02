import { buildMetadata } from '@/lib/seo';
import HomePageNext from "@/lib/pages/HomePageNext";

export const metadata = buildMetadata({
  title: "Immobilier, Événements & Communication à Brazzaville",
  description: "Altitude-Vision — Trouvez votre bien immobilier, organisez vos événements et boostez votre communication à Brazzaville, Congo.",
  url: "/",
});

export default function Page() {
  return <HomePageNext />;
}
