import { buildMetadata } from '@/lib/seo';
import AltcomPortfolioDetailPage from "@/lib/pages/altcom/AltcomPortfolioDetailPage";

export async function generateMetadata({ params }) {
  const { portfolioId } = await params;
  try {
    const res = await fetch(`https://altitude-vision.onrender.com/api/portfolio/${portfolioId}`, { next: { revalidate: 60 } });
    if (!res.ok) return buildMetadata({ title: 'Projet Portfolio', url: `/altcom/portfolio/${portfolioId}` });
    const item = await res.json();
    return buildMetadata({
      title: item.title,
      description: item.description?.slice(0, 155),
      image: item.images?.[0],
      url: `/altcom/portfolio/${portfolioId}`,
    });
  } catch {
    return buildMetadata({ title: 'Projet Portfolio', url: `/altcom/portfolio/${portfolioId}` });
  }
}

export default function Page() {
  return <AltcomPortfolioDetailPage />;
}
