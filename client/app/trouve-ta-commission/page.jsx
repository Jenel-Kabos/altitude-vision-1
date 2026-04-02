import { buildMetadata } from '@/lib/seo';
import CommissionCalculatorPage from "@/lib/pages/CommissionCalculatorPage";

export const metadata = buildMetadata({
  title: "Calcul de Commission Immobilière — Altimmo",
  description: "Estimez rapidement la commission d'agence sur votre bien immobilier avec notre calculateur.",
  url: "/trouve-ta-commission",
});

export default function Page() {
  return <CommissionCalculatorPage />;
}
