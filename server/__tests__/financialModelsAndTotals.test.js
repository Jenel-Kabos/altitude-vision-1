const FinancialDocument = require('../models/FinancialDocument');
const FinancialSequence = require('../models/FinancialSequence');
const PaymentAllocation = require('../models/PaymentAllocation');
const FinancialProviderEvent = require('../models/FinancialProviderEvent');
const FinancialLedgerEntry = require('../models/FinancialLedgerEntry');
const { calculateLine, calculateDocumentTotals } = require('../services/finance/financialDocumentService');

describe('Financial Core — modèles et index', () => {
  test('séquence, allocation, événement et document ont leurs unicités métier', () => {
    const indexes = (model) => model.schema.indexes().filter(([, options]) => options.unique).map(([keys]) => keys);
    expect(indexes(FinancialSequence)).toContainEqual({ domain: 1, establishmentType: 1, establishmentId: 1, documentType: 1, year: 1 });
    expect(indexes(PaymentAllocation)).toContainEqual({ domain: 1, establishmentId: 1, businessOperationKey: 1 });
    expect(indexes(FinancialProviderEvent)).toContainEqual({ provider: 1, providerEventId: 1 });
    expect(indexes(FinancialDocument)).toContainEqual({ domain: 1, businessOperationKey: 1 });
  });
  test('le journal interdit les mises à jour et suppressions', async () => {
    await expect(FinancialLedgerEntry.updateOne({}, {})).rejects.toThrow('FINANCIAL_LEDGER_APPEND_ONLY');
    await expect(FinancialLedgerEntry.deleteOne({})).rejects.toThrow('FINANCIAL_LEDGER_APPEND_ONLY');
  });
});

describe('Financial Core — totaux serveur', () => {
  const source = { description: 'Nuitées', quantity: 3, unitAmountMinor: 10000, discountAmountMinor: 1000, taxAmountMinor: 1800, feesAmountMinor: 200, lineType: 'accommodation', sourceType: 'HotelReservation', sourceId: '507f1f77bcf86cd799439011' };
  test('recalcule une ligne et ignore les totaux entrants', () => expect(calculateLine({ ...source, totalMinor: 1 })).toMatchObject({ subtotalMinor: 30000, totalMinor: 31000 }));
  test('agrège plusieurs lignes', () => expect(calculateDocumentTotals([source, { ...source, quantity: 1, discountAmountMinor: 0, taxAmountMinor: 0, feesAmountMinor: 0 }]).totals).toEqual({ subtotalMinor: 40000, discountTotalMinor: 1000, taxTotalMinor: 1800, feesTotalMinor: 200, totalMinor: 41000 }));
  test('rejette une remise supérieure au sous-total', () => expect(() => calculateLine({ ...source, discountAmountMinor: 40000 })).toThrow());
  test('rejette un document sans ligne', () => expect(() => calculateDocumentTotals([])).toThrow());
});
