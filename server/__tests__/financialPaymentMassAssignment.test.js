// PAY-3 §21/§28 — un client ne peut pas forcer un paiement à `succeeded`, ni
// choisir son `providerPaymentId`/`provider`, ni son `validatedBy`. Ce test
// vérifie directement le service qui construit le document `FinancialPayment`
// persisté : même si l'appelant (contrôleur, futur endpoint) transmettait ces
// champs dans `data`, ils ne doivent jamais atteindre la base telle quelle.
jest.mock('../models/FinancialPayment');
jest.mock('../services/finance/financialLedgerService', () => ({ appendFinancialLedgerEntry: jest.fn().mockResolvedValue() }));

const FinancialPayment = require('../models/FinancialPayment');
const { createManualPayment } = require('../services/finance/financialPaymentService');

const actor = { id: 'staff-1', platformTenant: null };

describe('financialPaymentService.createManualPayment — mass assignment (PAY-3)', () => {
  afterEach(() => jest.clearAllMocks());

  test('un statut/provider/validateur arbitraires dans data ne sont jamais persistés — seuls les champs serveur comptent', async () => {
    let createdDoc = null;
    FinancialPayment.findOne = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    FinancialPayment.create = jest.fn(async (docs) => {
      createdDoc = docs[0];
      return [{ ...createdDoc, _id: 'pay-1' }];
    });

    const data = {
      establishmentId: 'hotel-1',
      amountMinor: 10000,
      currency: 'XAF',
      method: 'cash',
      payer: { name: 'Client X' },
      subjectType: 'HotelReservation',
      subjectId: 'res-1',
      paymentReference: 'REF-1',
      // Champs qu'un client malveillant pourrait injecter dans le corps de
      // la requête — le service ne les lit jamais dans `data.*` ci-dessous :
      status: 'succeeded',
      confirmed: false, // volontairement false : la tentative de forcer via `status` doit échouer, pas seulement via `confirmed`
      provider: 'attacker_provider',
      providerPaymentId: 'ATTACKER-CHOSEN-ID',
      confirmedBy: 'attacker-user-id',
      manualValidation: { status: 'approved', approvedBy: 'attacker-user-id' },
    };

    await createManualPayment({ data, actor, businessOperationKey: 'test-key-1', transactionMode: 'fallback' });

    expect(createdDoc).not.toBeNull();
    expect(createdDoc.provider).toBe('manual'); // jamais data.provider
    expect(createdDoc.status).toBe('pending'); // jamais data.status — dérivé uniquement de data.confirmed===true
    expect(createdDoc.manualValidation.status).toBe('pending');
    expect(createdDoc.manualValidation.approvedBy).toBeNull();
    expect(createdDoc.manualValidation.submittedBy).toBe('staff-1'); // acteur serveur, jamais un id fourni par le client
    expect(createdDoc.confirmedBy).toBeNull();
    expect(createdDoc).not.toHaveProperty('providerPaymentId');
  });

  test('même avec confirmed=true, l’acteur qui confirme est toujours l’acteur serveur, jamais un id fourni par le client', async () => {
    let createdDoc = null;
    FinancialPayment.findOne = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    FinancialPayment.create = jest.fn(async (docs) => {
      createdDoc = docs[0];
      return [{ ...createdDoc, _id: 'pay-2' }];
    });

    const data = {
      establishmentId: 'hotel-1', amountMinor: 5000, currency: 'XAF', method: 'cash',
      subjectType: 'HotelReservation', subjectId: 'res-2', confirmed: true,
      confirmedBy: 'attacker-user-id', manualValidation: { approvedBy: 'attacker-user-id' },
    };

    await createManualPayment({ data, actor, businessOperationKey: 'test-key-2', transactionMode: 'fallback' });

    expect(createdDoc.status).toBe('succeeded');
    expect(createdDoc.confirmedBy).toBe('staff-1');
    expect(createdDoc.manualValidation.approvedBy).toBe('staff-1');
  });
});
