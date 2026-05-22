export const SITE_NAME    = 'Altitude-Vision';
export const SITE_URL     = 'https://altitudevision.agency';
export const DEFAULT_DESC = 'Altitude-Vision — Immobilier, Événementiel et Communication à Brazzaville.';

export function buildTitle(title) {
  return title
    ? `${title} | ${SITE_NAME}`
    : `${SITE_NAME} — Immobilier, Événements & Communication`;
}

export function buildMetadata({ title, description, image, url, noIndex = false }) {
  const resolvedTitle = buildTitle(title);
  const resolvedDesc  = description || DEFAULT_DESC;
  // Only set og:image when an explicit URL is provided — pages with opengraph-image.jsx
  // let Next.js resolve the generated image automatically (no images array = Next.js picks it up).
  const ogImages = image
    ? [{ url: image.startsWith('http') ? image : `${SITE_URL}${image}`, width: 1200, height: 630 }]
    : undefined;

  return {
    title:       resolvedTitle,
    description: resolvedDesc,
    robots:      noIndex ? 'noindex, nofollow' : 'index, follow',
    alternates:  { canonical: `${SITE_URL}${url || ''}` },
    openGraph: {
      title:       resolvedTitle,
      description: resolvedDesc,
      url:         `${SITE_URL}${url || ''}`,
      siteName:    SITE_NAME,
      locale:      'fr_CG',
      type:        'website',
      ...(ogImages && { images: ogImages }),
    },
    twitter: {
      card:        'summary_large_image',
      site:        '@AltitudeVision',
      title:       resolvedTitle,
      description: resolvedDesc,
      ...(ogImages && { images: [ogImages[0].url] }),
    },
  };
}
