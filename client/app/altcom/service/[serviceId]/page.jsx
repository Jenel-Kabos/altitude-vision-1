import { buildMetadata } from '@/lib/seo';
import AltcomServiceDetailPage from "@/lib/pages/altcom/AltcomServiceDetailPage";

export async function generateMetadata({ params }) {
  const { serviceId } = await params;
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/services/${serviceId}`, { next: { revalidate: 3600 } });
    if (!res.ok) return buildMetadata({ title: 'Service Altcom', url: `/altcom/service/${serviceId}` });
    const service = await res.json();
    return buildMetadata({
      title: `${service.title} — Altcom`,
      description: service.shortDesc || service.description?.slice(0, 155),
      url: `/altcom/service/${serviceId}`,
    });
  } catch {
    return buildMetadata({ title: 'Service Altcom', url: `/altcom/service/${serviceId}` });
  }
}

export default function Page() {
  return <AltcomServiceDetailPage />;
}
