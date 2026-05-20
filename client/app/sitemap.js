import { SITE_URL } from '@/lib/seo';

const API = process.env.NEXT_PUBLIC_API_URL;

async function fetchIds(path, selector) {
  try {
    const res = await fetch(`${API}${path}`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const json = await res.json();
    return selector(json) || [];
  } catch {
    return [];
  }
}

export default async function sitemap() {
  const [properties, events, portfolio] = await Promise.all([
    fetchIds('/properties?limit=500', j => j?.data?.properties),
    fetchIds('/events?limit=500',      j => j?.data?.events),
    fetchIds('/portfolio?limit=500',   j => j?.data?.items),
  ]);

  const staticRoutes = [
    { url: `${SITE_URL}/`,                   priority: 1.0, changeFrequency: 'daily'   },
    { url: `${SITE_URL}/altimmo`,            priority: 0.9, changeFrequency: 'daily'   },
    { url: `${SITE_URL}/altimmo/annonces`,   priority: 0.9, changeFrequency: 'daily'   },
    { url: `${SITE_URL}/mila-events`,        priority: 0.9, changeFrequency: 'daily'   },
    { url: `${SITE_URL}/mila-events/annonces`, priority: 0.8, changeFrequency: 'daily' },
    { url: `${SITE_URL}/altcom`,             priority: 0.8, changeFrequency: 'weekly'  },
    { url: `${SITE_URL}/altcom/annonces`,    priority: 0.7, changeFrequency: 'weekly'  },
    { url: `${SITE_URL}/contact`,            priority: 0.6, changeFrequency: 'monthly' },
    { url: `${SITE_URL}/actualites`,         priority: 0.6, changeFrequency: 'daily'   },
    { url: `${SITE_URL}/altimmo/services/vente-de-biens`,         priority: 0.7, changeFrequency: 'monthly' },
    { url: `${SITE_URL}/altimmo/services/location-gestion`,       priority: 0.7, changeFrequency: 'monthly' },
    { url: `${SITE_URL}/altimmo/services/conseil-investissement`,  priority: 0.7, changeFrequency: 'monthly' },
  ];

  const propertyRoutes = properties.map(p => ({
    url:             `${SITE_URL}/altimmo/property/${p._id}`,
    lastModified:    p.updatedAt ? new Date(p.updatedAt) : new Date(),
    priority:        0.8,
    changeFrequency: 'weekly',
  }));

  const eventRoutes = events.map(e => ({
    url:             `${SITE_URL}/mila-events/event/${e._id}`,
    lastModified:    e.updatedAt ? new Date(e.updatedAt) : new Date(),
    priority:        0.7,
    changeFrequency: 'weekly',
  }));

  const portfolioRoutes = portfolio.map(p => ({
    url:             `${SITE_URL}/altcom/portfolio/${p._id}`,
    lastModified:    p.updatedAt ? new Date(p.updatedAt) : new Date(),
    priority:        0.6,
    changeFrequency: 'monthly',
  }));

  return [...staticRoutes, ...propertyRoutes, ...eventRoutes, ...portfolioRoutes];
}
