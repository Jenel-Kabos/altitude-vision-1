import { buildMetadata } from '@/lib/seo';
import ConseilInvestissementPage from "@/lib/pages/services/ConseilInvestissementPage";

export const metadata = buildMetadata({
  title: "Conseil en Investissement Immobilier — Altimmo",
  description: "Nos experts vous conseillent pour vos investissements immobiliers à Brazzaville et au Congo.",
  url: "/altimmo/services/conseil-investissement",
});

export default function Page() {
  return <ConseilInvestissementPage />;
}
