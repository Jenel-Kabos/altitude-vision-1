type AppEnvironment = 'development' | 'preview' | 'production';

const DEFAULT_API_URL = 'https://altitude-vision.onrender.com/api';
const DEFAULT_SOCKET_URL = 'https://altitude-vision.onrender.com';

function parseUrl(name: string, value: string | undefined, fallback: string): string {
  const candidate = value?.trim() || fallback;

  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('unsupported protocol');
    }
    if (!__DEV__ && url.protocol !== 'https:') {
      throw new Error('HTTPS is required outside development');
    }
    return url.toString().replace(/\/$/, '');
  } catch {
    throw new Error(`[environment] ${name} must be a valid HTTP(S) URL`);
  }
}

function parseEnvironment(value: string | undefined): AppEnvironment {
  if (value === 'preview' || value === 'production') return value;
  return 'development';
}

export const environment = Object.freeze({
  name: parseEnvironment(process.env.EXPO_PUBLIC_APP_ENV),
  apiUrl: parseUrl('EXPO_PUBLIC_API_URL', process.env.EXPO_PUBLIC_API_URL, DEFAULT_API_URL),
  socketUrl: parseUrl(
    'EXPO_PUBLIC_SOCKET_URL',
    process.env.EXPO_PUBLIC_SOCKET_URL,
    DEFAULT_SOCKET_URL,
  ),
  sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN?.trim() || '',
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || '',
});

export type Environment = typeof environment;
