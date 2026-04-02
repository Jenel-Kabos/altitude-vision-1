import { buildMetadata } from '@/lib/seo';
import AltimmoPage from "@/lib/pages/AltimmoPage";

export const metadata = buildMetadata({
  title: "Altimmo — Achat, Vente & Location Immobilière à Brazzaville",
  description: "Altimmo by Altitude-Vision : trouvez des appartements, maisons et villas à vendre ou à louer à Brazzaville, Congo.",
  url: "/altimmo",
  image: "/og-altimmo.jpg",
});

export default function Page() {
  return <AltimmoPage />;
}
