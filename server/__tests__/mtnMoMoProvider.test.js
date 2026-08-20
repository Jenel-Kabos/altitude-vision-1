// PAY-4 — tests de l'adaptateur mtn_direct (contrat, MSISDN, statut,
// callback non fiable par construction). Le transport est mocké.
jest.mock('../services/payments/providers/mtn/mtnMoMoClient');
const mtnClient = require('../services/payments/providers/mtn/mtnMoMoClient');
const provider = require('../services/payments/providers/mtn/mtnMoMoProvider');

describe('mtnMoMoProvider — normalisation MSISDN (PAY-4 §15)', () => {
  test.each([
    ['242060000000', '242060000000'],
    ['+242060000000', '242060000000'],
    ['00242060000000', '242060000000'],
    ['060000000', '242060000000'],
    ['06 00 00 000', '242060000000'],
  ])('normalise "%s" → "%s"', (input, expected) => {
    expect(provider.normalizeMsisdn(input)).toBe(expected);
  });

  test.each(['123', 'abcdefghij', '', null, undefined, '24212345'])('rejette une entrée invalide "%s"', (input) => {
    expect(() => provider.normalizeMsisdn(input)).toThrow(expect.objectContaining({ code: 'MTN_MOMO_INVALID_MSISDN' }));
  });
});

describe('mtnMoMoProvider — normalisation de statut (PAY-4 §20)', () => {
  test.each([
    ['PENDING', 'pending'],
    ['SUCCESSFUL', 'succeeded'],
    ['FAILED', 'failed'],
  ])('"%s" → "%s"', (raw, expected) => {
    expect(provider.normalizeStatus(raw)).toBe(expected);
  });

  test('un statut MTN non documenté (ex: "cancelled" en minuscule, jamais observé) est rejeté explicitement', () => {
    expect(() => provider.normalizeStatus('cancelled')).toThrow(expect.objectContaining({ code: 'FINANCIAL_PROVIDER_STATUS_UNKNOWN' }));
  });
});

describe('mtnMoMoProvider — initiation (PAY-4 §14/§17/§19)', () => {
  afterEach(() => jest.clearAllMocks());

  test('un 202 MTN ne devient jamais un statut confirmé au niveau du provider', async () => {
    mtnClient.requestToPay.mockResolvedValue({ referenceId: 'ref-1', providerStatus: 'PENDING' });
    const result = await provider.initiatePayment({ amountMinor: 5000, msisdn: '242060000000', externalId: 'x1' });
    expect(result.normalizedStatus).toBe('pending');
    expect(result.providerPaymentId).toBe('ref-1');
  });

  test('la référence fournie par l’appelant (déjà persistée) est réutilisée, jamais régénérée (PAY-4 §17/§28)', async () => {
    mtnClient.requestToPay.mockResolvedValue({ referenceId: 'ref-pre-existante', providerStatus: 'PENDING' });
    await provider.initiatePayment({ referenceId: 'ref-pre-existante', amountMinor: 5000, msisdn: '242060000000', externalId: 'x1' });
    expect(mtnClient.requestToPay).toHaveBeenCalledWith(expect.objectContaining({ referenceId: 'ref-pre-existante' }));
    expect(mtnClient.generateReferenceId).not.toHaveBeenCalled();
  });

  test('sans référence fournie, le provider en génère une via le transport (source unique de génération)', async () => {
    mtnClient.generateReferenceId.mockReturnValue('generated-ref');
    mtnClient.requestToPay.mockResolvedValue({ referenceId: 'generated-ref', providerStatus: 'PENDING' });
    await provider.initiatePayment({ amountMinor: 5000, msisdn: '242060000000', externalId: 'x1' });
    expect(mtnClient.generateReferenceId).toHaveBeenCalledTimes(1);
  });
});

describe('mtnMoMoProvider — callback JAMAIS une preuve de confiance (PAY-4 §21/§22, anti-P0 CinetPay)', () => {
  test('extractCallbackReference ne renvoie jamais trusted:true, quel que soit le contenu du body', () => {
    const forged = { headers: {}, body: { externalId: 'ref-1', status: 'SUCCESSFUL', amount: '999999999' } };
    const result = provider.extractCallbackReference(forged);
    expect(result.trusted).toBe(false);
    expect(result).not.toHaveProperty('status');
    expect(result).not.toHaveProperty('amount');
  });

  test('un body sans référence exploitable est explicitement rejeté, jamais traité comme "aucune action"', () => {
    expect(() => provider.extractCallbackReference({ headers: {}, body: {} })).toThrow(
      expect.objectContaining({ code: 'MTN_MOMO_CALLBACK_INVALID' }),
    );
  });

  test('la référence peut être extraite du header X-Reference-Id (insensible à la casse HTTP standard)', () => {
    const req = { headers: { 'x-reference-id': 'ref-from-header' }, body: {} };
    expect(provider.extractCallbackReference(req).referenceId).toBe('ref-from-header');
  });
});
