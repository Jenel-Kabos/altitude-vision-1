export const SITE_NAME     = 'Altitude-Vision';
export const SITE_URL      = 'https://altitudevision.agency';
export const DEFAULT_IMG   = `${SITE_URL}/og-default.jpg`;
export const DEFAULT_DESC  = 'Altitude-Vision — Immobilier, Événementiel et Communication à Brazzaville.';

export function buildTitle(title) {
  return title
    ? `${title} | ${SITE_NAME}`
    : `${SITE_NAME} — Immobilier, Événements & Communication`;
}

export function buildMetadata({ title, description, image, url, noIndex = false }) {
  const ogImage = image?.startsWith('http') ? image : `${SITE_URL}${image || '/og-default.jpg'}`;
  return {
    title:       buildTitle(title),
    description: description || DEFAULT_DESC,
    robots:      noIndex ? 'noindex, nofollow' : 'index, follow',
    alternates:  { canonical: `${SITE_URL}${url || ''}` },
    openGraph: {
      title:       buildTitle(title),
      description: description || DEFAULT_DESC,
      url:         `${SITE_URL}${url || ''}`,
      siteName:    SITE_NAME,
      locale:      'fr_CG',
      type:        'website',
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card:        'summary_large_image',
      site:        '@AltitudeVision',
      title:       buildTitle(title),
      description: description || DEFAULT_DESC,
      images:      [ogImage],
    },
  };
}
