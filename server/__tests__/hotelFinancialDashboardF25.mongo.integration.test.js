const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const Hotel = require('../models/Hotel');
const HotelReservation = require('../models/HotelReservation');
const FinancialDocument = require('../models/FinancialDocument');
const FinancialPayment = require('../models/FinancialPayment');
const PaymentAllocation = require('../models/PaymentAllocation');
const FinancialLedgerEntry = require('../models/FinancialLedgerEntry');
const FinancialDocumentArtifact = require('../models/FinancialDocumentArtifact');
const FinancialDocumentDelivery = require('../models/FinancialDocumentDelivery');
const { HOTEL_CHECKOUT_FINANCIAL_OVERRIDE_EVENT } = require('../services/finance/hotelCheckoutFinancialReadinessService');
const dashboard = require('../services/finance/hotelFinancialDashboardService');
const { createTenantFixture, tenantActor } = require('./helpers/tenantAwareFixture');

jest.setTimeout(180000);
const id = () => new mongoose.Types.ObjectId();
const admin = { role: 'Admin', _id: id() };
let tenantFixture;
async function ensureTenant() {
  if (!tenantFixture) {
    tenantFixture = await createTenantFixture({ label: 'Hotel dashboard', bootstrap: admin });
    Object.assign(admin, tenantActor(admin, tenantFixture.tenant));
  }
  return tenantFixture;
}
const farFuture = new Date(Date.now() + 2 * 86400000).toISOString();
const farPast = new Date(Date.now() - 300 * 86400000).toISOString();

async function makeHotel(overrides = {}) {
  const managerId = id();
  const { tenant } = await ensureTenant();
  return Hotel.create({ name: 'Hôtel F2.5', tenant: tenant._id, brand: 'F25', email: 'f25@example.test', manager: managerId, createdBy: managerId, ...overrides });
}
async function makeReservation(hotel, overrides = {}) {
  return HotelReservation.create({ hotel: hotel._id, roomCategory: id(), guest: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.test', country: 'CG' }, checkInDate: new Date('2026-01-01'), checkOutDate: new Date('2026-01-03'), roomsCount: 1, adults: 1, unitPrice: 30000, subtotal: 60000, taxes: 0, fees: 0, discount: 0, totalAmount: 60000, currency: 'XAF', rateSnapshot: { rateType: 'nightly', amount: 30000, currency: 'XAF', version: 1 }, status: 'confirmed', source: 'owner_dashboard', createdBy: hotel.manager, ...overrides });
}
async function makeDocument(hotel, reservation, overrides = {}) {
  return FinancialDocument.create({
    domain: 'hotel', establishmentType: 'Hotel', establishmentId: hotel._id, documentType: 'invoice',
    documentNumber: overrides.documentNumber || `FAC-${id()}`, status: 'issued', currency: 'XAF',
    subjectType: 'HotelReservation', subjectId: reservation._id,
    issueDate: overrides.issueDate || new Date(), totalMinor: 100000, amountAllocatedMinor: 0, balanceMinor: 100000,
    businessOperationKey: `f25-doc-${id()}`, createdBy: hotel.manager,
    ...overrides,
  });
}
async function makePayment(hotel, reservation, overrides = {}) {
  return FinancialPayment.create({
    domain: 'hotel', establishmentType: 'Hotel', establishmentId: hotel._id, paymentReference: `PAY-${id()}`,
    status: 'succeeded', method: 'cash', currency: 'XAF', amountMinor: 100000, availableAmountMinor: 100000,
    subjectType: 'HotelReservation', subjectId: reservation._id, confirmedAt: overrides.confirmedAt || new Date(),
    createdBy: hotel.manager, confirmedBy: hotel.manager, ...overrides,
  });
}
async function makeAllocation(hotel, payment, document, overrides = {}) {
  return PaymentAllocation.create({
    financialPayment: payment._id, financialDocument: document._id, domain: 'hotel', establishmentType: 'Hotel',
    establishmentId: hotel._id, currency: 'XAF', amountMinor: overrides.amountMinor || 100000, status: 'active',
    businessOperationKey: `f25-alloc-${id()}`, allocatedAt: overrides.allocatedAt || new Date(), allocatedBy: hotel.manager,
    ...overrides,
  });
}

beforeAll(startFinancialMongo);
afterEach(async () => { await clearFinancialMongo(); tenantFixture = null; delete admin.platformTenant; delete admin.tenantScopeUserIds; });
afterAll(stopFinancialMongo);

test('agrège facturé/encaissé/alloué/restant sur un hôtel unique en distinguant surplus et allocations renversées', async () => {
  const hotel = await makeHotel();
  const reservation = await makeReservation(hotel);
  const paidDoc = await makeDocument(hotel, reservation, { totalMinor: 100000, amountAllocatedMinor: 100000, balanceMinor: 0 });
  const unpaidDoc = await makeDocument(hotel, reservation, { totalMinor: 50000, amountAllocatedMinor: 0, balanceMinor: 50000 });
  const partialDoc = await makeDocument(hotel, reservation, { totalMinor: 80000, amountAllocatedMinor: 30000, balanceMinor: 50000 });
  const payment = await makePayment(hotel, reservation, { amountMinor: 130000, availableAmountMinor: 30000 });
  await makeAllocation(hotel, payment, paidDoc, { amountMinor: 100000 });
  const reversed = await makeAllocation(hotel, payment, partialDoc, { amountMinor: 100000 });
  await PaymentAllocation.updateOne({ _id: reversed._id }, { $set: { status: 'reversed', reversedAt: new Date(), reversedBy: hotel.manager, reversalReason: 'test' } }).setOptions({});
  await makeAllocation(hotel, payment, partialDoc, { amountMinor: 30000 });

  const filters = dashboard.validateDashboardFilters({ hotelId: String(hotel._id), dateFrom: farPast, dateTo: farFuture });
  const summary = await dashboard.getHotelFinancialDashboardSummary({ user: admin, filters });

  expect(summary.totals.invoicedMinor).toBe(100000 + 50000 + 80000);
  expect(summary.totals.allocatedMinor).toBe(100000 + 30000); // n'inclut pas l'allocation renversée
  expect(summary.totals.outstandingMinor).toBe(50000 + 50000); // paidDoc a un solde nul, exclu de la somme
  expect(summary.totals.confirmedPaymentsMinor).toBe(130000);
  expect(summary.totals.unallocatedConfirmedMinor).toBe(30000); // surplus confirmé non alloué, séparé du solde restant
  expect(summary.documents.paidCount).toBe(1);
  expect(summary.documents.unpaidCount).toBe(1);
  expect(summary.documents.partiallyPaidCount).toBe(1);
  expect(unpaidDoc.status).toBe('issued');
});

test('isole strictement les données entre deux hôtels différents', async () => {
  const hotelA = await makeHotel({ name: 'Hôtel A' });
  const hotelB = await makeHotel({ name: 'Hôtel B' });
  const reservationA = await makeReservation(hotelA);
  const reservationB = await makeReservation(hotelB);
  await makeDocument(hotelA, reservationA, { totalMinor: 111000, balanceMinor: 111000 });
  await makeDocument(hotelB, reservationB, { totalMinor: 222000, balanceMinor: 222000 });

  const filtersA = dashboard.validateDashboardFilters({ hotelId: String(hotelA._id), dateFrom: farPast, dateTo: farFuture });
  const summaryA = await dashboard.getHotelFinancialDashboardSummary({ user: admin, filters: filtersA });
  expect(summaryA.totals.invoicedMinor).toBe(111000);

  const breakdownA = await dashboard.getHotelFinancialDashboardBreakdown({ user: admin, filters: filtersA, dimension: 'hotel' });
  expect(breakdownA.rows).toHaveLength(1);
  expect(String(breakdownA.rows[0].hotelId)).toBe(String(hotelA._id));

  // Un manager étranger à l'hôtel A doit être rejeté.
  const foreignManager = { role: 'Collaborateur', _id: id() };
  await expect(dashboard.getHotelFinancialDashboardSummary({ user: foreignManager, filters: filtersA })).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });

  // F2.6 : le manager légitime de l'hôtel A n'a qu'un seul hôtel accessible (rattachement legacy
  // Hotel.manager) — le serveur le déduit automatiquement même sans hotelId explicite (§26), et
  // ne lui montre jamais que les données de son propre hôtel.
  const managerA = { role: 'Collaborateur', _id: hotelA.manager };
  const autoScoped = await dashboard.getHotelFinancialDashboardSummary({ user: managerA, filters: dashboard.validateDashboardFilters({}) });
  expect(autoScoped.scope).toMatchObject({ global: false, hotelId: String(hotelA._id) });
  expect(autoScoped.totals.invoicedMinor).toBe(111000);
});

test('hotelId omis reste automatiquement borné à l’unique hôtel du tenant Admin', async () => {
  const hotelA = await makeHotel();
  const reservationA = await makeReservation(hotelA);
  await makeDocument(hotelA, reservationA, { totalMinor: 50000, balanceMinor: 0, amountAllocatedMinor: 50000 });
  const filters = dashboard.validateDashboardFilters({ dateFrom: farPast, dateTo: farFuture });
  const summary = await dashboard.getHotelFinancialDashboardSummary({ user: admin, filters });
  expect(summary.scope.global).toBe(false);
  expect(summary.scope.hotelId).toBe(String(hotelA._id));

  const managerNoHotel = { role: 'Collaborateur', _id: id() };
  await expect(dashboard.getHotelFinancialDashboardSummary({ user: managerNoHotel, filters })).rejects.toMatchObject({ code: 'FINANCIAL_DASHBOARD_ACCESS_DENIED' });
});

test('signale une devise non-XAF comme anomalie plutôt que de l’agréger silencieusement', async () => {
  const hotel = await makeHotel();
  const reservation = await makeReservation(hotel);
  await makeDocument(hotel, reservation, { currency: 'XAF', totalMinor: 10000, balanceMinor: 10000 });
  await makeDocument(hotel, reservation, { currency: 'EUR', totalMinor: 5000, balanceMinor: 5000 });
  const filters = dashboard.validateDashboardFilters({ hotelId: String(hotel._id), dateFrom: farPast, dateTo: farFuture });
  const summary = await dashboard.getHotelFinancialDashboardSummary({ user: admin, filters });
  expect(summary.documents.nonXafExcludedCount).toBe(1);
  expect(summary.dataStatus).not.toBe('healthy');
  const breakdown = await dashboard.getHotelFinancialDashboardBreakdown({ user: admin, filters, dimension: 'currency' });
  const eur = breakdown.rows.find((row) => row.currency === 'EUR');
  expect(eur.isSupported).toBe(false);
});

test('détecte les documents en anomalie via le service de réconciliation existant', async () => {
  const hotel = await makeHotel();
  const reservation = await makeReservation(hotel);
  // Solde incohérent avec les lignes/allocations : le document a un amountAllocatedMinor positif sans allocation active réelle.
  await makeDocument(hotel, reservation, { totalMinor: 100000, amountAllocatedMinor: 40000, balanceMinor: 60000, documentNumber: 'FAC-ANOMALY-1' });
  const filters = dashboard.validateDashboardFilters({ hotelId: String(hotel._id), dateFrom: farPast, dateTo: farFuture });
  const summary = await dashboard.getHotelFinancialDashboardSummary({ user: admin, filters });
  expect(summary.documents.anomalyCount).toBeGreaterThan(0);
  expect(['warning', 'critical']).toContain(summary.dataStatus);
});

test('vieillissement des créances réparti par ancienneté depuis issueDate', async () => {
  const hotel = await makeHotel();
  const reservation = await makeReservation(hotel);
  const now = Date.now();
  await makeDocument(hotel, reservation, { issueDate: new Date(now - 2 * 86400000), balanceMinor: 1000, totalMinor: 1000 });
  await makeDocument(hotel, reservation, { issueDate: new Date(now - 45 * 86400000), balanceMinor: 2000, totalMinor: 2000 });
  await makeDocument(hotel, reservation, { issueDate: new Date(now - 120 * 86400000), balanceMinor: 3000, totalMinor: 3000 });
  const filters = dashboard.validateDashboardFilters({ hotelId: String(hotel._id) });
  const aging = await dashboard.getHotelFinancialDashboardAging({ user: admin, filters });
  const byBucket = Object.fromEntries(aging.buckets.map((b) => [b.bucket, b]));
  expect(byBucket['0_7'].outstandingMinor).toBe(1000);
  expect(byBucket['31_60'].outstandingMinor).toBe(2000);
  expect(byBucket.over_90.outstandingMinor).toBe(3000);
});

test('compte les dérogations administratives de check-out et pagine les alertes de façon stable', async () => {
  const hotel = await makeHotel();
  const reservation = await makeReservation(hotel, { status: 'checked_in' });
  const blockedDoc = await makeDocument(hotel, reservation, { balanceMinor: 25000, totalMinor: 25000 });
  await FinancialLedgerEntry.create({
    eventType: HOTEL_CHECKOUT_FINANCIAL_OVERRIDE_EVENT.eventType, domain: 'hotel', establishmentType: 'Hotel', establishmentId: hotel._id,
    entityType: 'HotelReservation', entityId: reservation._id, actorType: 'user', actorId: hotel.manager,
    businessOperationKey: `override-${reservation._id}`, newState: { financialDocumentId: blockedDoc._id }, occurredAt: new Date(),
  });
  const filters = dashboard.validateDashboardFilters({ hotelId: String(hotel._id), dateFrom: farPast, dateTo: farFuture });
  const summary = await dashboard.getHotelFinancialDashboardSummary({ user: admin, filters });
  expect(summary.checkout.overrideCount).toBe(1);
  expect(summary.checkout.blockedCount).toBe(1);

  for (let i = 0; i < 15; i += 1) {
    await makeDocument(hotel, reservation, { balanceMinor: 1000 + i, totalMinor: 1000 + i, documentNumber: `FAC-ALERT-${i}` });
  }
  const page1 = await dashboard.getHotelFinancialDashboardAlerts({ user: admin, filters: dashboard.validateDashboardFilters({ hotelId: String(hotel._id), dateFrom: farPast, dateTo: farFuture, page: 1, limit: 10 }) });
  const page2 = await dashboard.getHotelFinancialDashboardAlerts({ user: admin, filters: dashboard.validateDashboardFilters({ hotelId: String(hotel._id), dateFrom: farPast, dateTo: farFuture, page: 2, limit: 10 }) });
  expect(page1.alerts).toHaveLength(10);
  expect(page1.pagination.total).toBeGreaterThanOrEqual(16);
  const idsPage1 = new Set(page1.alerts.map((a) => String(a.entityId) + a.code));
  const idsPage2 = new Set(page2.alerts.map((a) => String(a.entityId) + a.code));
  expect([...idsPage1].some((i) => idsPage2.has(i))).toBe(false); // pas de doublon entre pages
});

test('les PDF prêts et les emails envoyés/échoués/incertains sont comptés depuis les métadonnées persistées', async () => {
  const hotel = await makeHotel();
  const reservation = await makeReservation(hotel);
  const doc = await makeDocument(hotel, reservation, { balanceMinor: 0, amountAllocatedMinor: 100000 });
  await FinancialDocumentArtifact.create({ financialDocument: doc._id, domain: 'hotel', establishmentId: hotel._id, reservationId: reservation._id, artifactType: 'official_invoice_pdf', templateVersion: 'v1', snapshotHash: 'a'.repeat(64), status: 'ready', generatedAt: new Date(), generatedBy: hotel.manager, generationToken: 't1' });
  await FinancialDocumentDelivery.create({ financialDocument: doc._id, establishmentId: hotel._id, reservationId: reservation._id, artifact: id(), artifactHash: 'a'.repeat(64), artifactTemplateVersion: 'v1', recipient: 'client@example.test', subject: 'Facture', status: 'sent', attemptNumber: 1, idempotencyKeyHash: 'h1', payloadHash: 'p1', requestedBy: hotel.manager, requestedAt: new Date(), sentAt: new Date(), correlationId: 'c1' });
  await FinancialDocumentDelivery.create({ financialDocument: doc._id, establishmentId: hotel._id, reservationId: reservation._id, artifact: id(), artifactHash: 'a'.repeat(64), artifactTemplateVersion: 'v1', recipient: 'client2@example.test', subject: 'Facture', status: 'failed', attemptNumber: 1, idempotencyKeyHash: 'h2', payloadHash: 'p2', requestedBy: hotel.manager, requestedAt: new Date(), normalizedErrorCode: 'SMTP_REJECTED', correlationId: 'c2' });
  await FinancialDocumentDelivery.create({ financialDocument: doc._id, establishmentId: hotel._id, reservationId: reservation._id, artifact: id(), artifactHash: 'a'.repeat(64), artifactTemplateVersion: 'v1', recipient: 'client3@example.test', subject: 'Facture', status: 'delivery_unknown', attemptNumber: 1, idempotencyKeyHash: 'h3', payloadHash: 'p3', requestedBy: hotel.manager, requestedAt: new Date(), correlationId: 'c3' });

  const filters = dashboard.validateDashboardFilters({ hotelId: String(hotel._id), dateFrom: farPast, dateTo: farFuture });
  const summary = await dashboard.getHotelFinancialDashboardSummary({ user: admin, filters });
  expect(summary.delivery.pdfReadyCount).toBe(1);
  expect(summary.delivery.emailSentCount).toBe(1);
  expect(summary.delivery.emailFailedCount).toBe(1);
  expect(summary.delivery.emailUnknownCount).toBe(1);
});

test('les lectures concurrentes du dashboard ne mutent aucune donnée financière', async () => {
  const hotel = await makeHotel();
  const reservation = await makeReservation(hotel);
  const doc = await makeDocument(hotel, reservation, { balanceMinor: 20000, totalMinor: 20000 });
  const before = await FinancialDocument.findById(doc._id).lean();
  const filters = dashboard.validateDashboardFilters({ hotelId: String(hotel._id), dateFrom: farPast, dateTo: farFuture });
  await Promise.all(Array.from({ length: 8 }, () => dashboard.getHotelFinancialDashboardSummary({ user: admin, filters })));
  const after = await FinancialDocument.findById(doc._id).lean();
  expect(after).toEqual(before);
  expect(await FinancialDocument.countDocuments({})).toBe(1);
});

test('les tendances représentent les périodes sans activité et respectent la granularité demandée', async () => {
  const hotel = await makeHotel();
  const reservation = await makeReservation(hotel);
  await makeDocument(hotel, reservation, { issueDate: new Date('2026-01-01T00:00:00.000Z'), totalMinor: 10000, balanceMinor: 10000 });
  const filters = dashboard.validateDashboardFilters({ hotelId: String(hotel._id), dateFrom: '2026-01-01', dateTo: '2026-01-05', granularity: 'day' });
  const trends = await dashboard.getHotelFinancialDashboardTrends({ user: admin, filters });
  expect(trends.granularity).toBe('day');
  expect(trends.points.length).toBeGreaterThanOrEqual(4);
  expect(trends.points[0].invoicedMinor).toBe(10000);
  expect(trends.points[1].invoicedMinor).toBe(0);
});
