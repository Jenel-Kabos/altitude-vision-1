// PAY-4 — tests du transport MTN MoMo (mocks fidèles au contrat corroboré
// dans server/docs/PAY4_MTN_MOMO_REPORT.md §7 : POST /collection/token/,
// POST /collection/v1_0/requesttopay → 202, GET /collection/v1_0/requesttopay/:id
// → {status, reason?, financialTransactionId?}). Aucun appel réseau réel.
jest.mock('axios', () => ({ create: jest.fn() }));
const axios = require('axios');
const client = require('../services/payments/providers/mtn/mtnMoMoClient');

const ENV_VARS = {
  MTN_MOMO_ENVIRONMENT: 'sandbox',
  MTN_MOMO_BASE_URL: 'https://sandbox.momodeveloper.mtn.com',
  MTN_MOMO_SUBSCRIPTION_KEY: 'test-subscription-key',
  MTN_MOMO_API_USER: 'test-api-user',
  MTN_MOMO_API_KEY: 'test-api-key',
};

function setEnv() { Object.entries(ENV_VARS).forEach(([k, v]) => { process.env[k] = v; }); }
function clearEnv() { Object.keys(ENV_VARS).forEach((k) => { delete process.env[k]; }); }

describe('mtnMoMoClient — configuration (PAY-4 §8/§9/§45)', () => {
  beforeEach(() => { clearEnv(); client._resetForTests(); jest.clearAllMocks(); });

  test('sans configuration, un appel échoue explicitement avec MTN_MOMO_CONFIG_MISSING — jamais un appel réseau tenté', async () => {
    await expect(client.requestToPay({ referenceId: 'r1', amountMinor: 1000, msisdn: '242060000000', externalId: 'x1' }))
      .rejects.toMatchObject({ code: 'MTN_MOMO_CONFIG_MISSING' });
    expect(axios.create).not.toHaveBeenCalled();
  });
});

describe('mtnMoMoClient — token lifecycle (PAY-4 §11/§12/§13)', () => {
  let post; let get;
  beforeEach(() => {
    setEnv(); client._resetForTests(); jest.clearAllMocks();
    post = jest.fn(); get = jest.fn();
    axios.create.mockReturnValue({ post, get });
  });
  afterEach(() => clearEnv());

  test('récupère un token via Basic auth apiUser:apiKey et le met en cache', async () => {
    post.mockResolvedValueOnce({ data: { access_token: 'tok-1', token_type: 'access_token', expires_in: 3600 } });
    post.mockResolvedValueOnce({ status: 202 }); // requesttopay

    await client.requestToPay({ referenceId: 'ref-1', amountMinor: 5000, msisdn: '242060000000', externalId: 'ext-1' });

    expect(post).toHaveBeenNthCalledWith(1, '/collection/token/', null, expect.objectContaining({
      headers: expect.objectContaining({ Authorization: expect.stringMatching(/^Basic /), 'X-Target-Environment': 'sandbox' }),
    }));
    const basic = Buffer.from('test-api-user:test-api-key').toString('base64');
    expect(post.mock.calls[0][2].headers.Authorization).toBe(`Basic ${basic}`);
  });

  test('un second appel avant expiration réutilise le token en cache — un seul appel token/', async () => {
    post.mockResolvedValueOnce({ data: { access_token: 'tok-1', expires_in: 3600 } });
    post.mockResolvedValue({ status: 202 });

    await client.requestToPay({ referenceId: 'ref-1', amountMinor: 1000, msisdn: '242060000000', externalId: 'x1' });
    await client.requestToPay({ referenceId: 'ref-2', amountMinor: 1000, msisdn: '242060000000', externalId: 'x2' });

    const tokenCalls = post.mock.calls.filter(([path]) => path === '/collection/token/');
    expect(tokenCalls).toHaveLength(1);
  });

  test('token expiré (marge de sécurité) déclenche un nouveau fetch', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick'] });
    post.mockResolvedValueOnce({ data: { access_token: 'tok-1', expires_in: 60 } }); // courte durée
    post.mockResolvedValueOnce({ status: 202 });
    post.mockResolvedValueOnce({ data: { access_token: 'tok-2', expires_in: 3600 } });
    post.mockResolvedValueOnce({ status: 202 });

    await client.requestToPay({ referenceId: 'ref-1', amountMinor: 1000, msisdn: '242060000000', externalId: 'x1' });
    jest.advanceTimersByTime(61 * 1000); // dépasse expires_in + marge
    await client.requestToPay({ referenceId: 'ref-2', amountMinor: 1000, msisdn: '242060000000', externalId: 'x2' });

    const tokenCalls = post.mock.calls.filter(([path]) => path === '/collection/token/');
    expect(tokenCalls).toHaveLength(2);
    jest.useRealTimers();
  });

  test('20 requêtes concurrentes ne déclenchent qu’un seul refresh de token (single-flight, PAY-4 §13)', async () => {
    let resolveToken;
    post.mockImplementationOnce(() => new Promise((resolve) => { resolveToken = resolve; }));
    post.mockResolvedValue({ status: 202 });

    const calls = Array.from({ length: 20 }, (_, i) => client.requestToPay({ referenceId: `ref-${i}`, amountMinor: 1000, msisdn: '242060000000', externalId: `x${i}` }));
    await Promise.resolve(); await Promise.resolve();
    resolveToken({ data: { access_token: 'tok-shared', expires_in: 3600 } });
    await Promise.all(calls);

    const tokenCalls = post.mock.calls.filter(([path]) => path === '/collection/token/');
    expect(tokenCalls).toHaveLength(1);
  });

  test('le token n’apparaît jamais dans un log (PAY-4 §9/§49)', async () => {
    const logger = require('../utils/logger');
    const infoSpy = jest.spyOn(logger, 'info');
    post.mockResolvedValueOnce({ data: { access_token: 'super-secret-token-value', expires_in: 3600 } });
    post.mockResolvedValue({ status: 202 });

    await client.requestToPay({ referenceId: 'ref-1', amountMinor: 1000, msisdn: '242060000000', externalId: 'x1' });

    const loggedPayloads = JSON.stringify(infoSpy.mock.calls);
    expect(loggedPayloads).not.toContain('super-secret-token-value');
    expect(loggedPayloads).not.toContain('test-api-key');
    infoSpy.mockRestore();
  });
});

describe('mtnMoMoClient — RequestToPay (PAY-4 §14/§19)', () => {
  let post;
  beforeEach(() => {
    setEnv(); client._resetForTests(); jest.clearAllMocks();
    post = jest.fn();
    axios.create.mockReturnValue({ post, get: jest.fn() });
    post.mockResolvedValueOnce({ data: { access_token: 'tok-1', expires_in: 3600 } });
  });
  afterEach(() => clearEnv());

  test('202 Accepted → { providerStatus: "PENDING" }, jamais confirmé (§19)', async () => {
    post.mockResolvedValueOnce({ status: 202 });
    const result = await client.requestToPay({ referenceId: 'ref-1', amountMinor: 5000, msisdn: '242060000000', externalId: 'x1' });
    expect(result.providerStatus).toBe('PENDING');
  });

  test('un statut HTTP différent de 202 n’est jamais traité comme un succès implicite', async () => {
    post.mockResolvedValueOnce({ status: 200 });
    await expect(client.requestToPay({ referenceId: 'ref-1', amountMinor: 5000, msisdn: '242060000000', externalId: 'x1' }))
      .rejects.toMatchObject({ code: 'MTN_MOMO_PROVIDER_ERROR' });
  });

  test('un timeout réseau après RequestToPay lève MTN_MOMO_TIMEOUT — jamais retenté automatiquement ici (PAY-4 §28)', async () => {
    post.mockRejectedValueOnce({ code: 'ECONNABORTED', message: 'timeout of 15000ms exceeded' });
    await expect(client.requestToPay({ referenceId: 'ref-1', amountMinor: 5000, msisdn: '242060000000', externalId: 'x1' }))
      .rejects.toMatchObject({ code: 'MTN_MOMO_TIMEOUT' });
    expect(post).toHaveBeenCalledTimes(2); // 1 token + 1 requesttopay tenté une seule fois
  });
});

describe('mtnMoMoClient — GetTransactionStatus (PAY-4 §25)', () => {
  let get;
  beforeEach(() => {
    setEnv(); client._resetForTests(); jest.clearAllMocks();
    const post = jest.fn().mockResolvedValueOnce({ data: { access_token: 'tok-1', expires_in: 3600 } });
    get = jest.fn();
    axios.create.mockReturnValue({ post, get });
  });
  afterEach(() => clearEnv());

  test.each(['PENDING', 'SUCCESSFUL', 'FAILED'])('renvoie le statut brut "%s" tel que documenté', async (status) => {
    get.mockResolvedValueOnce({ data: { status, financialTransactionId: status === 'SUCCESSFUL' ? 'ft-1' : undefined, reason: status === 'FAILED' ? 'NOT_ENOUGH_FUNDS' : undefined } });
    const result = await client.getTransactionStatus({ referenceId: 'ref-1' });
    expect(result.status).toBe(status);
  });
});
