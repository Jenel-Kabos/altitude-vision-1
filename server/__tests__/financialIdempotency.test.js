jest.mock('../models/FinancialProviderEvent');
const FinancialProviderEvent = require('../models/FinancialProviderEvent');
const { hashPayload, registerProviderEvent } = require('../services/finance/financialIdempotencyService');

describe('Financial Core — idempotence fournisseur', () => {
  beforeEach(() => jest.clearAllMocks());
  test('hash stable sans persister le payload', () => expect(hashPayload({ b: 2 })).toBe(hashPayload({ b: 2 })));
  test('crée le premier événement', async () => {
    FinancialProviderEvent.create.mockResolvedValue({ _id: 'event-1' });
    await expect(registerProviderEvent({ provider: 'sandbox', providerEventId: 'evt-1', eventType: 'payment.test', payload: { secret: 'x' }, signatureVerified: true, businessOperationKey: 'op-1' })).resolves.toEqual({ event: { _id: 'event-1' }, duplicate: false });
    expect(FinancialProviderEvent.create).toHaveBeenCalledWith(expect.objectContaining({ payloadHash: expect.any(String), signatureVerified: true }));
    expect(FinancialProviderEvent.create.mock.calls[0][0]).not.toHaveProperty('payload');
  });
  test('retourne l’événement existant en doublon', async () => {
    FinancialProviderEvent.create.mockRejectedValue(Object.assign(new Error('duplicate'), { code: 11000 }));
    FinancialProviderEvent.findOne.mockResolvedValue({ _id: 'event-existing' });
    await expect(registerProviderEvent({ provider: 'sandbox', providerEventId: 'evt-1', eventType: 'x', payload: {}, signatureVerified: true, businessOperationKey: 'op-1' })).resolves.toEqual({ event: { _id: 'event-existing' }, duplicate: true });
  });
});
