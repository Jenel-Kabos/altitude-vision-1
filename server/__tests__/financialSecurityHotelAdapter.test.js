jest.mock('../models/Hotel');
const Hotel = require('../models/Hotel');
const FinancialDocument = require('../models/FinancialDocument');
const FinancialPayment = require('../models/FinancialPayment');
const authz = require('../services/finance/financialAuthorizationService');
const { buildHotelReservationInvoiceLines, assertReservationCanBeBilled } = require('../services/finance/hotelBillingAdapter');

const HOTEL_ID = '507f1f77bcf86cd799439012';
const OWNER_ID = '507f1f77bcf86cd799439015';
const query = (value) => ({ select: jest.fn().mockResolvedValue(value) });

describe('Financial Core — isolation et permissions', () => {
  beforeEach(() => jest.clearAllMocks());
  test('le manager de l’hôtel peut gérer uniquement son établissement', async () => {
    Hotel.findById.mockReturnValue(query({ _id: HOTEL_ID, manager: OWNER_ID }));
    await expect(authz.assertCanManageHotelFinance({ id: OWNER_ID, role: 'Proprietaire' }, HOTEL_ID)).resolves.toMatchObject({ _id: HOTEL_ID });
  });
  test('un propriétaire tiers est refusé', async () => {
    Hotel.findById.mockReturnValue(query({ _id: HOTEL_ID, manager: OWNER_ID }));
    await expect(authz.assertCanManageHotelFinance({ id: '507f1f77bcf86cd799439099', role: 'Proprietaire' }, HOTEL_ID)).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED', statusCode: 403 });
  });
  test('un rôle non comptable ne peut émettre ni allouer', async () => {
    await expect(authz.assertAccountingRole({ role: 'GestionnaireImmobilier' })).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
  });
  test('admin et secrétaire ont la capacité comptable sans contourner l’ownership', async () => {
    await expect(authz.assertAccountingRole({ role: 'Admin' })).resolves.toBe(true);
    await expect(authz.assertAccountingRole({ role: 'Secretaire' })).resolves.toBe(true);
  });
  test('la matrice de capacités financières reste explicite et fermée', () => {
    expect(authz.hasFinancialCapability({ role: 'Secretaire' }, 'financial.payment.create')).toBe(true);
    expect(authz.hasFinancialCapability({ role: 'Proprietaire' }, 'financial.document.issue')).toBe(false);
    expect(() => authz.assertFinancialCapability({ role: 'Client' }, 'financial.ledger.view')).toThrow(expect.objectContaining({ code: 'FINANCIAL_UNAUTHORIZED' }));
  });
  test('le hash invité et les métadonnées fournisseur sont exclus par défaut', () => {
    expect(FinancialDocument.schema.path('guestAccess.tokenHash').options.select).toBe(false);
    expect(FinancialPayment.schema.path('providerMetadata').options.select).toBe(false);
  });
});

describe('Financial Core — adaptateur hôtel snapshot', () => {
  const reservation = { _id: '507f1f77bcf86cd799439011', reference: 'RES-2026-1', status: 'confirmed', nights: 2, roomsCount: 3, unitPrice: 10000, subtotal: 60000, taxes: 1200, fees: 800, discount: 2000, totalAmount: 60000, currency: 'XAF', checkInDate: new Date('2026-08-01') };
  test('construit la ligne depuis le snapshot sans lire RatePlan', () => {
    const [line] = buildHotelReservationInvoiceLines(reservation, OWNER_ID);
    expect(line).toMatchObject({ quantity: 6, unitAmountMinor: 10000, subtotalMinor: 60000, discountAmountMinor: 2000, taxAmountMinor: 1200, feesAmountMinor: 800, totalMinor: 60000, sourceType: 'HotelReservation' });
  });
  test.each(['cancelled', 'expired', 'rejected'])('refuse une réservation %s', (status) => expect(() => assertReservationCanBeBilled({ ...reservation, status })).toThrow());
  test('autorise pending, confirmed et checked-in sans modifier la réservation', () => {
    for (const status of ['pending', 'confirmed', 'checked_in']) expect(assertReservationCanBeBilled({ ...reservation, status })).toBeUndefined();
  });
});
