import ArticlePage from '@/lib/pages/articles/ArticlePage';
import JsonLd from '@/lib/components/JsonLd';
import { ARTICLES } from '@/lib/data/articlesData';
import { SITE_URL } from '@/lib/seo';

export async function generateStaticParams() {
    return ARTICLES.map(a => ({ slug: a.slug }));
}

export async function generateMetadata({ params }) {
    const article = ARTICLES.find(a => a.slug === params.slug);
    if (!article) return { title: 'Article introuvable — Altitude-Vision' };
    return {
        title: `${article.title} — Altitude-Vision`,
        description: article.excerpt,
        alternates: { canonical: `${SITE_URL}/actualites/${article.slug}` },
        openGraph: {
            title: article.title,
            description: article.excerpt,
            images: [{ url: article.image }],
            type: 'article',
        },
    };
}

export default function ArticleRoute({ params }) {
    const article = ARTICLES.find(a => a.slug === params.slug);

    const schemas = article ? [
        {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
                { "@type": "ListItem", position: 1, name: "Accueil",     item: SITE_URL },
                { "@type": "ListItem", position: 2, name: "Actualités",  item: `${SITE_URL}/actualites` },
                { "@type": "ListItem", position: 3, name: article.title, item: `${SITE_URL}/actualites/${article.slug}` },
            ],
        },
        {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: article.title,
            description: article.excerpt,
            image: article.image,
            datePublished: article.date,
            author: { "@type": "Organization", name: "Altitude-Vision", url: SITE_URL },
            publisher: {
                "@type": "Organization",
                name: "Altitude-Vision",
                url: SITE_URL,
                logo: { "@type": "ImageObject", url: `${SITE_URL}/images/Logo_Altitude1.png` },
            },
            url: `${SITE_URL}/actualites/${article.slug}`,
            keywords: article.tags?.join(', '),
        },
    ] : [];

    return (
        <>
            {schemas.length > 0 && <JsonLd schemas={schemas} />}
            <ArticlePage slug={params.slug} />
        </>
    );
}
