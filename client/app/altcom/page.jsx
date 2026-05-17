import { buildMetadata } from '@/lib/seo';
import AltcomPage from "@/lib/pages/altcom/AltcomPage";

export const metadata = buildMetadata({
  title: "Altcom — Agence de Communication & Branding à Brazzaville",
  description: "Altcom by Altitude-Vision : stratégie digitale, création de marque, campagnes publicitaires et production audiovisuelle à Brazzaville, Congo.",
  url: "/altcom",
  image: "/og-altcom.jpg",
});

export default function Page() {
  return <AltcomPage />;
}
