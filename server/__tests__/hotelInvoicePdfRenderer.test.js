const mongoose = require('mongoose');
const { buildOfficialSnapshot, renderOfficialInvoicePdf, sha256, safeFilename, TEMPLATE_VERSION } = require('../services/finance/hotelInvoicePdfRenderer');

const document = (overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(), domain: 'hotel', status: 'issued', documentType: 'invoice', documentNumber: 'FAC/HÔTEL/001', issueDate: new Date('2026-09-03T00:00:00Z'), currency: 'XAF', subjectId: new mongoose.Types.ObjectId(),
  customer: { name: 'Élodie Mpassi', email: 'elodie@example.test', phone: '+242000000', address: 'Brazzaville' }, seller: { name: 'Hôtel Étoile', email: 'hotel@example.test' },
  servicePeriodStart: new Date('2026-09-01'), servicePeriodEnd: new Date('2026-09-03'), subtotalMinor: 60000, discountTotalMinor: 4000, taxTotalMinor: 3000, feesTotalMinor: 1000, totalMinor: 60000,
  metadata: { linesFinalized: true, reservationReference: 'RES-001', source: 'hotel_reservation' }, ...overrides,
});
const lines = [{ lineNumber: 1, description: 'Séjour supérieur', quantity: 2, unitAmountMinor: 30000, subtotalMinor: 60000, discountAmountMinor: 4000, taxAmountMinor: 3000, feesAmountMinor: 1000, totalMinor: 60000 }];

test('construit un snapshot officiel normalisé uniquement depuis le document et les lignes', () => {
  const snapshot = buildOfficialSnapshot(document(), lines);
  expect(snapshot).toMatchObject({ templateVersion: TEMPLATE_VERSION, currency: 'XAF', reservationReference: 'RES-001', customer: { name: 'Élodie Mpassi' }, totals: { totalMinor: 60000 } });
  expect(snapshot).not.toHaveProperty('paymentStatus');
});

test.each([[{ status: 'draft' }, 'FINANCIAL_DOCUMENT_NOT_ISSUED'], [{ currency: 'EUR' }, 'FINANCIAL_CURRENCY_UNSUPPORTED'], [{ metadata: { linesFinalized: false } }, 'FINANCIAL_PDF_GENERATION_FAILED']])('refuse un document non admissible %#', (override, code) => {
  expect(() => buildOfficialSnapshot(document(override), lines)).toThrow(expect.objectContaining({ code }));
});

test('rend un PDF déterministe, accentué, versionné et hashable en SHA-256', async () => {
  const snapshot = buildOfficialSnapshot(document(), lines);
  const [first, second] = await Promise.all([renderOfficialInvoicePdf(snapshot), renderOfficialInvoicePdf(snapshot)]);
  expect(first.subarray(0, 4).toString()).toBe('%PDF');
  expect(sha256(first)).toMatch(/^[a-f0-9]{64}$/);
  expect(sha256(first)).toBe(sha256(second));
  expect(safeFilename('FAC/HÔTEL/001')).toBe('facture-FAC-H-TEL-001.pdf');
});

test('refuse les totaux incohérents', () => expect(() => buildOfficialSnapshot(document({ totalMinor: 1 }), lines)).toThrow(expect.objectContaining({ code: 'FINANCIAL_PDF_GENERATION_FAILED' })));
