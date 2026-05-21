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
  "img-src 'self' data: blob: https://images.unsplash.com https://altitude-vision.onrender.com https://res.cloudinary.com https://graph.facebook.com",
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
  webpack: (config) => {
    config.resolve.alias['@'] = path.resolve(__dirname);
    return config;
  },
  async headers() {
    return [{ source: '/(.*)', headers: SECURITY_HEADERS }];
  },
};
export default nextConfig;