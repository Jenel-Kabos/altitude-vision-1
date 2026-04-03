import ArticlePage from '@/lib/pages/articles/ArticlePage';
import { ARTICLES } from '@/lib/data/articlesData';

export async function generateStaticParams() {
    return ARTICLES.map(a => ({ slug: a.slug }));
}

export async function generateMetadata({ params }) {
    const article = ARTICLES.find(a => a.slug === params.slug);
    if (!article) return { title: 'Article introuvable — Altitude-Vision' };
    return {
        title: `${article.title} — Altitude-Vision`,
        description: article.excerpt,
        openGraph: {
            title: article.title,
            description: article.excerpt,
            images: [{ url: article.image }],
        },
    };
}

export default function ArticleRoute({ params }) {
    return <ArticlePage slug={params.slug} />;
}
