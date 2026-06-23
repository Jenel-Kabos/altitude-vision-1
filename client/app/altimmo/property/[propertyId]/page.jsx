import { buildMetadata, SITE_URL } from '@/lib/seo';
import PropertyDetailPage from "@/lib/pages/PropertyDetailPage";
import JsonLd from "@/lib/components/JsonLd";

async function getProperty(id) {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/properties/${id}`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data?.property || json;
  } catch { return null; }
}

export async function generateMetadata({ params }) {
  const { propertyId } = await params;
  const property = await getProperty(propertyId);
  if (!property) return buildMetadata({ title: 'Bien immobilier — Altimmo', url: `/altimmo/property/${propertyId}` });
  const city = property.address?.city || 'Brazzaville';
  return buildMetadata({
    title:       `${property.title} — ${property.type || 'Bien'} à ${city}`,
    description: `${property.type || 'Bien'} à ${city} — ${property.description?.slice(0, 120) || ''}`,
    image:       property.images?.[0],
    url:         `/altimmo/property/${propertyId}`,
  });
}

export default async function Page({ params }) {
  const { propertyId } = await params;
  const property = await getProperty(propertyId);

  const schemas = [];

  if (property) {
    const city = property.address?.city || 'Brazzaville';
    const addressParts = [
      property.address?.street,
      property.address?.arrondissement,
      city,
    ].filter(Boolean);

    schemas.push({
      "@context": "https://schema.org",
      "@type":    "RealEstateListing",
      name:        property.title,
      description: property.description,
      url:         `${SITE_URL}/altimmo/property/${propertyId}`,
      image:       (property.images || [])
        .filter(Boolean)
        .map(img => img.startsWith('http') ? img : `${SITE_URL}${img}`),
      ...(property.price && {
        offers: {
          "@type":         "Offer",
          price:           property.price,
          priceCurrency:   "XAF",
          availability:    property.availability === 'Disponible'
            ? "https://schema.org/InStock"
            : "https://schema.org/SoldOut",
        },
      }),
      address: {
        "@type":         "PostalAddress",
        streetAddress:   addressParts.slice(0, -1).join(', '),
        addressLocality: city,
        addressCountry:  "CG",
      },
      ...(property.surface && { floorSize: { "@type": "QuantitativeValue", value: property.surface, unitCode: "MTK" } }),
    });

    schemas.push({
      "@context":     "https://schema.org",
      "@type":        "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil",   item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Altimmo",   item: `${SITE_URL}/altimmo` },
        { "@type": "ListItem", position: 3, name: "Annonces",  item: `${SITE_URL}/altimmo/annonces` },
        { "@type": "ListItem", position: 4, name: property.title, item: `${SITE_URL}/altimmo/property/${propertyId}` },
      ],
    });
  }

  return (
    <>
      {schemas.length > 0 && <JsonLd schemas={schemas} />}
      <PropertyDetailPage />
    </>
  );
}
