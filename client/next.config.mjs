import { fileURLToPath } from 'url';
import path from 'path';
const __dirname = fileURLToPath(new URL('.', import.meta.url));

const CSP = [
  "default-src 'self'",
  // Next.js hydration + Framer Motion require unsafe-inline; unsafe-eval for dev HMR
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  // Framer Motion and Tailwind write inline styles at runtime
  "style-src 'self' 'unsafe-inline'",
  // Fonts are self-hosted via next/font — no external font CDN needed
  "font-src 'self'",
  // Images: local, Unsplash (hero), Cloudinary (uploads), Render (legacy), Facebook (feed)
  "img-src 'self' data: blob: https://images.unsplash.com https://altitude-vision.onrender.com https://res.cloudinary.com https://graph.facebook.com https://*.fbcdn.net https://platform-lookaside.fbsbx.com https://ui-avatars.com https://placehold.co https://illustrations.popsy.co",
  // API calls + Facebook feed data
  "connect-src 'self' https://altitude-vision.onrender.com https://graph.facebook.com https://www.facebook.com",
  "frame-src 'none'",
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