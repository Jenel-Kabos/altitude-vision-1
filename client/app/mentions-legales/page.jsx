import { buildMetadata } from '@/lib/seo';
import MentionsLegales from "@/lib/pages/MentionsLegales";

export const metadata = buildMetadata({
  title: "Mentions Légales — Altitude-Vision",
  description: "Consultez les mentions légales d'Altitude-Vision.",
  url: "/mentions-legales",
});

export default function Page() {
  return <MentionsLegales />;
}
