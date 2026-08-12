// CLOUDINARY-SANDBOX-PROVISION-1 — guards de configuration sandbox. Le SDK
// `cloudinary` est mocké pour PROUVER qu'aucune méthode réseau n'est jamais
// appelée par la validation locale, quel que soit le scénario testé.
jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: { upload: jest.fn(), rename: jest.fn(), destroy: jest.fn() },
    api: { resource: jest.fn(), ping: jest.fn() },
  },
}));
const cloudinary = require('cloudinary');

const ENV_KEYS = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_SANDBOX_CLOUD_NAME', 'CLOUDINARY_SANDBOX_API_KEY', 'CLOUDINARY_SANDBOX_API_SECRET', 'CLOUDINARY_SANDBOX_CONFIRM'];
let savedEnv;

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  ENV_KEYS.forEach((k) => delete process.env[k]);
  jest.resetModules();
  jest.clearAllMocks();
});
afterEach(() => {
  ENV_KEYS.forEach((k) => {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  });
});

function load() {
  return require('../config/cloudinarySandbox');
}

function expectZeroNetworkCalls() {
  expect(cloudinary.v2.config).not.toHaveBeenCalled();
  expect(cloudinary.v2.uploader.upload).not.toHaveBeenCalled();
  expect(cloudinary.v2.uploader.rename).not.toHaveBeenCalled();
  expect(cloudinary.v2.uploader.destroy).not.toHaveBeenCalled();
  expect(cloudinary.v2.api.resource).not.toHaveBeenCalled();
  expect(cloudinary.v2.api.ping).not.toHaveBeenCalled();
}

test('1. sandbox absent → CLOUDINARY_SANDBOX_NOT_CONFIGURED, aucun appel réseau', () => {
  const { validateSandboxConfig, ERROR_CODES } = load();
  const result = validateSandboxConfig();
  expect(result.status).toBe('INVALID');
  expect(result.code).toBe(ERROR_CODES.NOT_CONFIGURED);
  expectZeroNetworkCalls();
});

test('2. credentials présents, confirmation absente → CLOUDINARY_SANDBOX_CONFIRMATION_REQUIRED', () => {
  process.env.CLOUDINARY_SANDBOX_CLOUD_NAME = 'altitude-vision-sandbox-fixture';
  process.env.CLOUDINARY_SANDBOX_API_KEY = '123456789';
  process.env.CLOUDINARY_SANDBOX_API_SECRET = 'fixture-secret';
  const { validateSandboxConfig, ERROR_CODES } = load();
  const result = validateSandboxConfig();
  expect(result.code).toBe(ERROR_CODES.CONFIRMATION_REQUIRED);
  expectZeroNetworkCalls();
});

test('3. config partielle (api_key manquante) → CLOUDINARY_SANDBOX_INVALID_CONFIG', () => {
  process.env.CLOUDINARY_SANDBOX_CLOUD_NAME = 'altitude-vision-sandbox-fixture';
  process.env.CLOUDINARY_SANDBOX_API_SECRET = 'fixture-secret';
  const { validateSandboxConfig, ERROR_CODES } = load();
  const result = validateSandboxConfig();
  expect(result.code).toBe(ERROR_CODES.INVALID_CONFIG);
  expectZeroNetworkCalls();
});

test('3bis. config partielle (api_secret manquant) → CLOUDINARY_SANDBOX_INVALID_CONFIG', () => {
  process.env.CLOUDINARY_SANDBOX_CLOUD_NAME = 'altitude-vision-sandbox-fixture';
  process.env.CLOUDINARY_SANDBOX_API_KEY = '123456789';
  const { validateSandboxConfig, ERROR_CODES } = load();
  const result = validateSandboxConfig();
  expect(result.code).toBe(ERROR_CODES.INVALID_CONFIG);
  expectZeroNetworkCalls();
});

test('4. collision production → CLOUDINARY_SANDBOX_PRODUCTION_COLLISION, zéro appel réseau', () => {
  process.env.CLOUDINARY_CLOUD_NAME = 'dop8vzm5z';
  process.env.CLOUDINARY_SANDBOX_CLOUD_NAME = 'dop8vzm5z';
  process.env.CLOUDINARY_SANDBOX_API_KEY = '123456789';
  process.env.CLOUDINARY_SANDBOX_API_SECRET = 'fixture-secret';
  process.env.CLOUDINARY_SANDBOX_CONFIRM = 'YES';
  const { validateSandboxConfig, ERROR_CODES } = load();
  const result = validateSandboxConfig();
  expect(result.code).toBe(ERROR_CODES.PRODUCTION_COLLISION);
  expectZeroNetworkCalls();
});

test('5. credentials production présents mais sandbox absent → NOT_CONFIGURED, jamais un repli vers production', () => {
  process.env.CLOUDINARY_CLOUD_NAME = 'dop8vzm5z';
  const { validateSandboxConfig, ERROR_CODES } = load();
  const result = validateSandboxConfig();
  expect(result.code).toBe(ERROR_CODES.NOT_CONFIGURED);
  expect(result.config).toBeUndefined();
  expectZeroNetworkCalls();
});

test('6. configuration sandbox synthétique distincte → VALID, structure acceptée sans appel réseau', () => {
  process.env.CLOUDINARY_CLOUD_NAME = 'dop8vzm5z';
  process.env.CLOUDINARY_SANDBOX_CLOUD_NAME = 'altitude-vision-sandbox-fixture';
  process.env.CLOUDINARY_SANDBOX_API_KEY = '123456789';
  process.env.CLOUDINARY_SANDBOX_API_SECRET = 'fixture-secret';
  process.env.CLOUDINARY_SANDBOX_CONFIRM = 'YES';
  const { validateSandboxConfig } = load();
  const result = validateSandboxConfig();
  expect(result.status).toBe('VALID');
  expect(result.config.cloudName).toBe('altitude-vision-sandbox-fixture');
  expectZeroNetworkCalls();
});

test('7. le résultat de validation ne contient jamais le secret fourni', () => {
  process.env.CLOUDINARY_SANDBOX_CLOUD_NAME = 'altitude-vision-sandbox-fixture';
  process.env.CLOUDINARY_SANDBOX_API_KEY = '123456789';
  process.env.CLOUDINARY_SANDBOX_API_SECRET = 'super-secret-value-never-leaked';
  process.env.CLOUDINARY_SANDBOX_CONFIRM = 'YES';
  const { validateSandboxConfig } = load();
  const result = validateSandboxConfig();
  expect(JSON.stringify(result)).not.toContain('super-secret-value-never-leaked');
  expect(JSON.stringify(result)).not.toContain('123456789');
});

test('8. aucun appel réseau pendant validation locale, même pour un scénario VALID (createSandboxCloudinaryClient non appelé)', () => {
  process.env.CLOUDINARY_SANDBOX_CLOUD_NAME = 'altitude-vision-sandbox-fixture';
  process.env.CLOUDINARY_SANDBOX_API_KEY = '123456789';
  process.env.CLOUDINARY_SANDBOX_API_SECRET = 'fixture-secret';
  process.env.CLOUDINARY_SANDBOX_CONFIRM = 'YES';
  const { assertSandboxConfigValid } = load();
  expect(() => assertSandboxConfigValid()).not.toThrow();
  expectZeroNetworkCalls();
});

test('assertSandboxConfigValid lève une erreur typée (code) en cas de configuration invalide', () => {
  const { assertSandboxConfigValid, ERROR_CODES } = load();
  expect(() => assertSandboxConfigValid()).toThrow();
  try {
    assertSandboxConfigValid();
  } catch (error) {
    expect(error.code).toBe(ERROR_CODES.NOT_CONFIGURED);
  }
});

describe('isolation de process (Phase 30 — risque SDK global découvert)', () => {
  test('createSandboxCloudinaryClient refuse si config/cloudinary.js (production) est déjà chargé dans ce process', () => {
    process.env.CLOUDINARY_SANDBOX_CLOUD_NAME = 'altitude-vision-sandbox-fixture';
    process.env.CLOUDINARY_SANDBOX_API_KEY = '123456789';
    process.env.CLOUDINARY_SANDBOX_API_SECRET = 'fixture-secret';
    process.env.CLOUDINARY_SANDBOX_CONFIRM = 'YES';
    // Simule le cas réel : un contrôleur métier a déjà chargé la config de
    // production dans ce process (comportement normal de l'application).
    require('../config/cloudinary');
    jest.clearAllMocks(); // ce require lui-même appelle cloudinary.config() — non pertinent pour cette assertion
    const { createSandboxCloudinaryClient, ERROR_CODES } = load();
    expect(() => createSandboxCloudinaryClient()).toThrow();
    try {
      createSandboxCloudinaryClient();
    } catch (error) {
      expect(error.code).toBe(ERROR_CODES.PROCESS_ISOLATION_REQUIRED);
    }
    expectZeroNetworkCalls();
  });
});
