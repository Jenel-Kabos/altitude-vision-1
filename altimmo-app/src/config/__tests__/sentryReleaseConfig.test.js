/* eslint-env node, jest */
// GOOGLE-PLAY-R2.1 — le DSN Sentry de production est fourni par EAS sous le nom
// `SENTRY_DSN` (variable secrète, jamais inlinée par Metro faute de préfixe
// EXPO_PUBLIC_). app.config.js l'expose dans `extra.sentryDsn` au moment du
// build et l'application s'y rabat. Valeurs factices uniquement.
const FAKE_DSN = 'https://public-key@o0.ingest.sentry.invalid/0';

describe('app.config.js', () => {
  const load = () => { jest.resetModules(); return require('../../../app.config.js').expo; };
  afterEach(() => { delete process.env.SENTRY_DSN; });

  test('expose SENTRY_DSN du builder dans extra.sentryDsn', () => {
    process.env.SENTRY_DSN = ` ${FAKE_DSN} `;
    expect(load().extra.sentryDsn).toBe(FAKE_DSN);
  });

  test('sans SENTRY_DSN, aucune entrée sentryDsn', () => {
    expect(load().extra.sentryDsn).toBeUndefined();
  });
});

describe('environment.sentryDsn', () => {
  const loadEnvironment = (extra) => {
    jest.resetModules();
    jest.doMock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra } } }));
    return require('../environment').environment;
  };
  afterEach(() => { delete process.env.EXPO_PUBLIC_SENTRY_DSN; jest.dontMock('expo-constants'); });

  test('release EAS : se rabat sur extra.sentryDsn quand EXPO_PUBLIC_SENTRY_DSN est absent', () => {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    expect(loadEnvironment({ sentryDsn: FAKE_DSN }).sentryDsn).toBe(FAKE_DSN);
  });

  test('EXPO_PUBLIC_SENTRY_DSN reste prioritaire', () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://other@o0.ingest.sentry.invalid/1';
    expect(loadEnvironment({ sentryDsn: FAKE_DSN }).sentryDsn).toBe('https://other@o0.ingest.sentry.invalid/1');
  });

  test('aucun DSN → chaîne vide (Sentry désactivé)', () => {
    expect(loadEnvironment({}).sentryDsn).toBe('');
  });
});
