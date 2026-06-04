import { fileURLToPath } from 'url';
import path from 'path';
const __dirname = fileURLToPath(new URL('.', import.meta.url));

const CSP = [
  "default-src 'self'",
  // Next.js hydration + Framer Motion require unsafe-inline; unsafe-eval for dev HMR; blob: for Web Workers / PDF libs
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://www.googletagmanager.com https://www.google-analytics.com",
  // Framer Motion and Tailwind write inline styles at runtime
  "style-src 'self' 'unsafe-inline'",
  // Fonts are self-hosted via next/font — no external font CDN needed
  "font-src 'self'",
  // Images: local, Unsplash (hero), Cloudinary (uploads), Render (legacy), Facebook (feed), Leaflet tiles + marker icons
  "img-src 'self' data: blob: https://images.unsplash.com https://altitude-vision.onrender.com https://res.cloudinary.com https://graph.facebook.com https://*.fbcdn.net https://platform-lookaside.fbsbx.com https://ui-avatars.com https://placehold.co https://illustrations.popsy.co https://*.googleusercontent.com https://*.tile.openstreetmap.org https://*.tile.openstreetmap.fr https://*.basemaps.cartocdn.com https://unpkg.com",
  // Videos: Cloudinary hosted videos + blob: for local object URLs
  "media-src 'self' https://res.cloudinary.com https://*.cloudinary.com blob:",
  // API calls + Facebook feed data; blob: for fetch() responses; GA endpoints; Leaflet tile/geocoding requests
  "connect-src 'self' blob: https://altitude-vision.onrender.com https://graph.facebook.com https://www.facebook.com https://www.google-analytics.com https://analytics.google.com https://stats.g.doubleclick.net https://region1.google-analytics.com https://*.tile.openstreetmap.org https://nominatim.openstreetmap.org",
  // Web Workers (e.g. PDF.js, comlink) require blob: worker source
  "worker-src 'self' blob:",
  // child-src covers blob: workers in older browsers that don't support worker-src
  "child-src 'self' blob:",
  // Google Maps embed on /contact
  "frame-src https://www.google.com https://maps.google.com https://maps.googleapis.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy',   value: CSP },
  { key: 'X-Content-Type-Options',    value: 'nosniff' },
  { key: 'X-Frame-Options',           value: 'SAMEORIGIN' },
  { key: 'X-XSS-Protection',          value: '1; mode=block' },
  { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: __dirname,
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'altitude-vision.onrender.com' },
      { protocol: 'https', hostname: 'graph.facebook.com' },
      { protocol: 'https', hostname: '**.googleusercontent.com' },
      { protocol: 'https', hostname: '**.fbcdn.net' },
      { protocol: 'https', hostname: 'platform-lookaside.fbsbx.com' },
      { protocol: 'https', hostname: 'illustrations.popsy.co' },
      { protocol: 'https', hostname: 'placehold.co' },
      { protocol: 'https', hostname: 'ui-avatars.com' },
    ],
  },
  webpack: (config) => {
    config.resolve.alias['@'] = path.resolve(__dirname);
    return config;
  },
  async headers() {
    return [{ source: '/(.*)', headers: SECURITY_HEADERS }];
  },
};
export default nextConfig;