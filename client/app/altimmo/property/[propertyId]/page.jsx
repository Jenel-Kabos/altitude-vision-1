import { buildMetadata } from '@/lib/seo';
import PropertyDetailPage from "@/lib/pages/PropertyDetailPage";

export async function generateMetadata({ params }) {
  const { propertyId } = await params;
  try {
    const res = await fetch(`https://altitude-vision.onrender.com/api/properties/${propertyId}`, { next: { revalidate: 60 } });
    if (!res.ok) return buildMetadata({ title: 'Bien immobilier', url: `/altimmo/property/${propertyId}` });
    const property = await res.json();
    return buildMetadata({
      title: property.title,
      description: `${property.type || 'Bien'} à ${property.address?.city || 'Brazzaville'} — ${property.description?.slice(0, 120)}…`,
      image: property.images?.[0],
      url: `/altimmo/property/${propertyId}`,
    });
  } catch {
    return buildMetadata({ title: 'Bien immobilier', url: `/altimmo/property/${propertyId}` });
  }
}

export default function Page() {
  return <PropertyDetailPage />;
}
