import { buildMetadata } from '@/lib/seo';
import CouvertureMediatiquePage from "@/lib/pages/altcom/CouvertureMediatiquePage";

export const metadata = buildMetadata({
  title: "Couverture Médiatique — Altcom",
  description: "Altcom assure la couverture médiatique de vos événements à Brazzaville : photos, vidéos, live.",
  url: "/altcom/couverture-mediatique",
});

export default function Page() {
  return <CouvertureMediatiquePage />;
}
