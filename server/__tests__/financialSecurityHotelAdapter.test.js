jest.mock('../models/Hotel');
jest.mock('../services/platformTenant/tenantResourceAttributionService', () => ({
  assertResourceTenant: jest.fn().mockResolvedValue({ status: 'resolved', tenantId: '607f1f77bcf86cd799439001' }),
}));
const Hotel = require('../models/Hotel');
const FinancialDocument = require('../models/FinancialDocument');
const FinancialPayment = require('../models/FinancialPayment');
const authz = require('../services/finance/financialAuthorizationService');
const { buildHotelReservationInvoiceLines, assertReservationCanBeBilled } = require('../services/finance/hotelBillingAdapter');

const HOTEL_ID = '507f1f77bcf86cd799439012';
const OWNER_ID = '507f1f77bcf86cd799439015';
const TENANT_ID = '607f1f77bcf86cd799439001';
const query = (value) => ({ select: jest.fn().mockResolvedValue(value) });

jest.mock('../services/tenantMembershipService', () => ({ resolveTenantMembership: jest.fn() }));
jest.mock('../services/platformOperator/platformOperatorService', () => ({ resolveActiveOperator: jest.fn() }));
const { resolveTenantMembership } = require('../services/tenantMembershipService');
const { resolveActiveOperator } = require('../services/platformOperator/platformOperatorService');
const { assertResourceTenant } = require('../services/platformTenant/tenantResourceAttributionService');
const tenantActor = (role = 'Client') => ({ id: OWNER_ID, role, platformTenant: { _id: TENANT_ID, status: 'active' } });
const membership = (businessRole = 'Admin') => ({ status: 'active', businessRole, tenant: { _id: TENANT_ID, status: 'active' }, membership: { status: 'active' } });

describe('Financial authority — explicit tenant and platform planes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveTenantMembership.mockResolvedValue(null);
    resolveActiveOperator.mockResolvedValue(null);
    assertResourceTenant.mockResolvedValue({ tenantId: TENANT_ID });
    Hotel.findById.mockReturnValue(query({ _id: HOTEL_ID, tenant: TENANT_ID, manager: OWNER_ID }));
  });
  test.each(['assertCanCreateFinancialPayment', 'assertCanConfirmFinancialPayment', 'assertCanAllocatePayment'])('FA-01..03 global Admin alone denied: %s', async (operation) => {
    await expect(authz[operation](tenantActor('Admin'), HOTEL_ID)).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
  });
  test.each(['Client', 'Proprietaire', 'Collaborateur', 'Admin'])('FA-08/13/14 manager or identity %s without membership denied', async (role) => {
    await expect(authz.assertCanCreateFinancialPayment(tenantActor(role), HOTEL_ID)).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
  });
  test('FA-04/09 active membership authorizes independently of global identity and manager', async () => {
    resolveTenantMembership.mockResolvedValue(membership());
    const actor = { ...tenantActor(), id: '507f1f77bcf86cd799439099' };
    await expect(authz.assertCanCreateFinancialPayment(actor, HOTEL_ID)).resolves.toMatchObject({ _id: HOTEL_ID });
    expect(resolveTenantMembership).toHaveBeenCalledWith(actor.id, TENANT_ID);
  });
  test.each([null, { ambiguous: true }, { ...membership(), status: 'suspended' }, { ...membership(), status: 'revoked' }, { ...membership(), tenant: { status: 'suspended' } }])('FA-05..07 invalid membership fails closed: %j', async (resolved) => {
    resolveTenantMembership.mockResolvedValue(resolved);
    await expect(authz.assertCanAllocatePayment(tenantActor(), HOTEL_ID)).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
  });
  test.each(['Collaborateur', 'CommunityManager', 'Communicant', 'GestionnaireImmobilier'])('no implicit money-management permission for membership %s', async (role) => {
    resolveTenantMembership.mockResolvedValue(membership(role));
    await expect(authz.assertCanConfirmFinancialPayment(tenantActor(), HOTEL_ID)).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
  });
  test('secretary gets payments.manage operations, not reversal or override', async () => {
    resolveTenantMembership.mockResolvedValue(membership('Secretaire'));
    await expect(authz.assertCanConfirmFinancialPayment(tenantActor(), HOTEL_ID)).resolves.toBeDefined();
    await expect(authz.assertCanReverseAllocation(tenantActor(), HOTEL_ID)).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
  });
  test('FA-10/12 operator without finance capability cannot fall back to global Admin', async () => {
    resolveActiveOperator.mockResolvedValue({ status: 'active', capabilities: [] });
    await expect(authz.assertCanConfirmFinancialPayment({ ...tenantActor('Admin'), isPlatformOperatorContext: true }, HOTEL_ID)).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
  });
  test('FA-11 explicit platform finance works without membership', async () => {
    resolveActiveOperator.mockResolvedValue({ status: 'active', capabilities: ['platform.finance.manage'] });
    await expect(authz.assertCanAllocatePayment({ ...tenantActor(), isPlatformOperatorContext: true }, HOTEL_ID)).resolves.toBeDefined();
    expect(resolveTenantMembership).not.toHaveBeenCalled();
  });
  test('platform finance.read cannot mutate', async () => {
    resolveActiveOperator.mockResolvedValue({ status: 'active', capabilities: ['platform.finance.read'] });
    await expect(authz.assertCanViewFinancialPayment(tenantActor(), HOTEL_ID)).resolves.toBeDefined();
    await expect(authz.assertCanConfirmFinancialPayment(tenantActor(), HOTEL_ID)).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
  });
  test('FA-15/16 cross-tenant resource fails closed even for platform finance', async () => {
    resolveActiveOperator.mockResolvedValue({ status: 'active', capabilities: ['platform.finance.manage'] });
    assertResourceTenant.mockRejectedValue(new Error('wrong tenant'));
    await expect(authz.assertCanAllocatePayment(tenantActor(), HOTEL_ID)).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
  });
  test('manager without canonical tenant context denied', async () => {
    await expect(authz.assertCanCreateFinancialPayment({ id: OWNER_ID, role: 'Admin' }, HOTEL_ID)).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
  });
  test('sensitive fields remain excluded', () => {
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
