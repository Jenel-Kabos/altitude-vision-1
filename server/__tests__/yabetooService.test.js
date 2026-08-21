jest.mock('axios');
const axios = require('axios');
const service = require('../services/yabetooService');

describe('yabetooService — contrat et résilience', () => {
  const previous = { ...process.env };
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.YABETOO_SECRET_KEY = 'sk_test_masked';
    process.env.YABETOO_API_URL = 'https://pay.sandbox.yabetoopay.com/v1';
    process.env.YABETOO_TIMEOUT_MS = '1234';
  });
  afterAll(() => { process.env = previous; });

  test('CREATE envoie uniquement le contrat serveur officiel', async () => {
    axios.mockResolvedValue({ data: { id: 'pi_1', clientSecret: 'never-log-this' } });
    await service.createIntent({ amount: 5000, phone: 'forged', operator: 'forged', description: 'Visite', metadata: { visiteId: 'v1' } });
    expect(axios).toHaveBeenCalledWith(expect.objectContaining({
      method: 'post', url: '/payment-intents', timeout: 1234,
      data: { amount: 5000, currency: 'XAF', description: 'Visite', metadata: { visiteId: 'v1' } },
      headers: expect.objectContaining({ Authorization: 'Bearer sk_test_masked' }),
    }));
  });

  test('CONFIRM transmet client_secret et les données MoMo sans les logger', async () => {
    axios.mockResolvedValue({ data: { status: 'pending' } });
    await service.confirmIntent('pi/1', { clientSecret: 'cs_secret', phone: '242000000001', operator: 'MTN', firstName: 'Ada' });
    expect(axios).toHaveBeenCalledWith(expect.objectContaining({
      url: '/payment-intents/pi%2F1/confirm',
      data: { client_secret: 'cs_secret', payment_method_data: { type: 'momo', momo: { country: 'CG', msisdn: '242000000001', operator_name: 'MTN' } }, first_name: 'Ada' },
    }));
  });

  test.each(['ECONNABORTED', 'ETIMEDOUT'])('classe %s comme résultat ambigu sans retry', async (code) => {
    axios.mockRejectedValue(Object.assign(new Error('secret body'), { code }));
    await expect(service.createIntent({ amount: 1 })).rejects.toMatchObject({ code: 'provider_timeout_unknown', details: { ambiguous: true } });
    expect(axios).toHaveBeenCalledTimes(1);
  });

  test('échoue fermé si la clé manque ou si la configuration est invalide', async () => {
    delete process.env.YABETOO_SECRET_KEY;
    await expect(service.getIntent('pi_1')).rejects.toMatchObject({ code: 'provider_auth_failure' });
    process.env.YABETOO_SECRET_KEY = 'sk_test_masked'; process.env.YABETOO_API_URL = 'http://unsafe';
    await expect(service.getIntent('pi_1')).rejects.toMatchObject({ code: 'provider_invalid_config' });
    expect(axios).not.toHaveBeenCalled();
  });

  test('rejette montant non entier et réponse extractible incomplète', async () => {
    await expect(service.createIntent({ amount: 1.5 })).rejects.toMatchObject({ code: 'provider_invalid_request' });
    expect(service.extractIntent({ data: { id: 'pi_1', status: 'pending' } })).toEqual({ id: 'pi_1', clientSecret: undefined, status: 'pending' });
  });
});
