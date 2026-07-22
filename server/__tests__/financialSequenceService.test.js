jest.mock('../models/FinancialSequence');
const FinancialSequence = require('../models/FinancialSequence');
const { getNextFinancialDocumentNumber } = require('../services/finance/financialSequenceService');

const base = { domain: 'hotel', establishmentType: 'Hotel', establishmentId: '507f1f77bcf86cd799439012', documentType: 'invoice', year: 2026, establishmentCode: 'BZV01' };
describe('Financial Core — séquence atomique', () => {
  beforeEach(() => jest.clearAllMocks());
  test('utilise un seul findOneAndUpdate atomique avec $inc et upsert', async () => {
    FinancialSequence.findOneAndUpdate.mockResolvedValue({ currentValue: 1, prefix: 'FAC' });
    await expect(getNextFinancialDocumentNumber(base)).resolves.toEqual({ sequenceValue: 1, formattedNumber: 'FAC-BZV01-2026-000001' });
    expect(FinancialSequence.findOneAndUpdate).toHaveBeenCalledWith(expect.objectContaining({ establishmentId: base.establishmentId, documentType: 'invoice', year: 2026 }), { $inc: { currentValue: 1 }, $setOnInsert: { prefix: 'FAC' } }, expect.objectContaining({ new: true, upsert: true }));
  });
  test('incrémente sans lecture préalable', async () => {
    FinancialSequence.findOneAndUpdate.mockResolvedValue({ currentValue: 42, prefix: 'FAC' });
    await expect(getNextFinancialDocumentNumber(base)).resolves.toMatchObject({ formattedNumber: 'FAC-BZV01-2026-000042' });
    expect(FinancialSequence.findOne).not.toHaveBeenCalled();
  });
  test.each([
    [{ establishmentId: '507f1f77bcf86cd799439099' }, 'FAC-BZV01-2026-000001'],
    [{ documentType: 'credit_note' }, 'AVO-BZV01-2026-000001'],
    [{ year: 2027 }, 'FAC-BZV01-2027-000001'],
  ])('isole la clé de séquence %p', async (changes, expected) => {
    FinancialSequence.findOneAndUpdate.mockResolvedValue({ currentValue: 1, prefix: changes.documentType === 'credit_note' ? 'AVO' : 'FAC' });
    await expect(getNextFinancialDocumentNumber({ ...base, ...changes })).resolves.toMatchObject({ formattedNumber: expected });
    expect(FinancialSequence.findOneAndUpdate.mock.calls[0][0]).toMatchObject(changes);
  });
});
