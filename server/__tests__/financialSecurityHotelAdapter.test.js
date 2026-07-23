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
  test('le gestionnaire rattaché peut gérer uniquement son établissement', async () => {
    Hotel.findById.mockReturnValue(query({ _id: HOTEL_ID, manager: OWNER_ID }));
    await expect(authz.assertCanIssueFinancialDocument({ id: OWNER_ID, role: 'Collaborateur' }, HOTEL_ID)).resolves.toMatchObject({ _id: HOTEL_ID });
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
    expect(authz.hasFinancialCapability({ role: 'Proprietaire' }, authz.CAPABILITIES.DOCUMENT_VIEW)).toBe(true);
    expect(authz.hasFinancialCapability({ role: 'Admin' }, authz.CAPABILITIES.HOTEL_CHECKOUT_OVERRIDE)).toBe(true);
    expect(authz.hasFinancialCapability({ role: 'Collaborateur' }, authz.CAPABILITIES.HOTEL_CHECKOUT_OVERRIDE)).toBe(false);
    expect(() => authz.assertFinancialCapability({ role: 'Client' }, 'financial.ledger.view')).toThrow(expect.objectContaining({ code: 'FINANCIAL_UNAUTHORIZED' }));
  });
  test('le propriétaire rattaché consulte mais ne modifie pas', async () => {
    Hotel.findById.mockReturnValue(query({ _id: HOTEL_ID, manager: OWNER_ID }));
    await expect(authz.assertCanViewFinancialDocument({ id: OWNER_ID, role: 'Proprietaire' }, HOTEL_ID)).resolves.toMatchObject({ _id: HOTEL_ID });
    await expect(authz.assertCanCreateFinancialDraft({ id: OWNER_ID, role: 'Proprietaire' }, HOTEL_ID)).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
    await expect(authz.assertCanAllocatePayment({ id: OWNER_ID, role: 'Proprietaire' }, HOTEL_ID)).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
  });
  test('un collaborateur non rattaché est refusé sans résidu', async () => {
    Hotel.findById.mockReturnValue(query({ _id: HOTEL_ID, manager: OWNER_ID }));
    await expect(authz.assertCanCreateFinancialDraft({ id: '507f1f77bcf86cd799439099', role: 'Collaborateur' }, HOTEL_ID)).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED', statusCode: 403 });
  });
  test('Admin conserve une portée globale et toutes les capacités', async () => {
    Hotel.findById.mockReturnValue(query({ _id: HOTEL_ID, manager: OWNER_ID }));
    await expect(authz.assertCanIssueFinancialDocument({ id: '507f1f77bcf86cd799439099', role: 'Admin' }, HOTEL_ID)).resolves.toMatchObject({ _id: HOTEL_ID });
    expect(Object.values(authz.CAPABILITIES).every((capability) => authz.hasFinancialCapability({ role: 'Admin' }, capability))).toBe(true);
  });
  test('le hash invité et les métadonnées fournisseur sont exclus par défaut', () => {
    expect(FinancialDocument.schema.path('guestAccess.tokenHash').options.select).toBe(false);
    expect(FinancialPayment.schema.path('providerMetadata').options.select).toBe(false);
  });
});

describe('Financial Core — adaptateur hôtel snapshot', () => {
  const reservation = { _id: '507f1f77bcf86cd799439011', reference: 'RES-2026-1', status: 'confirmed', nights: 2, roomsCount: 3, unitPrice: 10000, subtotal: 60000, taxes: 1200, fees: 800, discount: 2000, totalAmount: 60000, currency: 'XAF', rateSnapshot: { rateType: 'nightly', amount: 10000, currency: 'XAF' }, guest: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.test' }, checkInDate: new Date('2026-08-01') };
  test('construit la ligne depuis le snapshot sans lire RatePlan', () => {
    const [line] = buildHotelReservationInvoiceLines(reservation, OWNER_ID);
    expect(line).toMatchObject({ quantity: 6, unitAmountMinor: 10000, subtotalMinor: 60000, discountAmountMinor: 2000, taxAmountMinor: 1200, feesAmountMinor: 800, totalMinor: 60000, sourceType: 'HotelReservation' });
  });
  test.each(['cancelled', 'expired', 'rejected'])('refuse une réservation %s', (status) => expect(() => assertReservationCanBeBilled({ ...reservation, status })).toThrow());
  test('autorise confirmed et checked-in sans modifier la réservation', () => {
    for (const status of ['confirmed', 'checked_in']) expect(assertReservationCanBeBilled({ ...reservation, status })).toBeUndefined();
  });
  test.each(['pending', 'checked_out'])('refuse une réservation %s', (status) => expect(() => assertReservationCanBeBilled({ ...reservation, status })).toThrow());
  test('refuse snapshot incomplet et devise non XAF', () => {
    expect(() => assertReservationCanBeBilled({ ...reservation, rateSnapshot: null })).toThrow(expect.objectContaining({ code: 'FINANCIAL_RESERVATION_SNAPSHOT_INCOMPLETE' }));
    expect(() => assertReservationCanBeBilled({ ...reservation, currency: 'EUR' })).toThrow(expect.objectContaining({ code: 'FINANCIAL_CURRENCY_UNSUPPORTED' }));
  });
});
