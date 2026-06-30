import { buildMetadata, SITE_URL } from '@/lib/seo';
import AltcomPortfolioDetailPage from "@/lib/pages/altcom/AltcomPortfolioDetailPage";
import JsonLd from "@/lib/components/JsonLd";

async function getPortfolioItem(id) {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/portfolio/${id}`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data?.item || json;
  } catch { return null; }
}

export async function generateMetadata({ params }) {
  const { portfolioId } = await params;
  const item = await getPortfolioItem(portfolioId);
  if (!item) return buildMetadata({ title: 'Projet Portfolio — Communication', url: `/communication/portfolio/${portfolioId}` });
  return buildMetadata({
    title:       `${item.title} — Altcom`,
    description: item.description?.slice(0, 155),
    image:       item.images?.[0],
    url:         `/communication/portfolio/${portfolioId}`,
  });
}

export default async function Page({ params }) {
  const { portfolioId } = await params;
  const item = await getPortfolioItem(portfolioId);

  const schemas = [];

  if (item) {
    const images = (item.images || [])
      .filter(Boolean)
      .map(img => img.startsWith('http') ? img : `${SITE_URL}${img}`);

    schemas.push({
      "@context":   "https://schema.org",
      "@type":      "CreativeWork",
      name:          item.title,
      description:   item.description,
      url:           `${SITE_URL}/communication/portfolio/${portfolioId}`,
      image:         images,
      creator: {
        "@type": "Organization",
        name:    "Altcom — Altitude-Vision",
        url:     `${SITE_URL}/communication`,
      },
      ...(item.client && { contributor: { "@type": "Organization", name: item.client } }),
      ...(item.projectDate && { dateCreated: new Date(item.projectDate).toISOString().split('T')[0] }),
      ...(item.category && { genre: item.category }),
    });

    schemas.push({
      "@context":     "https://schema.org",
      "@type":        "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil",        item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Communication",  item: `${SITE_URL}/communication` },
        { "@type": "ListItem", position: 3, name: "Portfolio",      item: `${SITE_URL}/communication/annonces` },
        { "@type": "ListItem", position: 4, name: item.title,       item: `${SITE_URL}/communication/portfolio/${portfolioId}` },
      ],
    });
  }

  return (
    <>
      {schemas.length > 0 && <JsonLd schemas={schemas} />}
      <AltcomPortfolioDetailPage />
    </>
  );
}
