import { buildMetadata } from '@/lib/seo';
import HomePageNext from "@/lib/pages/HomePageNext";

export const metadata = buildMetadata({
  title: "Immobilier, Événements & Communication à Brazzaville",
  description: "200+ familles logées, 80+ événements réussis, 80+ marques accompagnées. La seule agence à Brazzaville qui réunit immobilier, événementiel et communication sous un même toit.",
  url: "/",
});

export default function Page() {
  return <HomePageNext />;
}
