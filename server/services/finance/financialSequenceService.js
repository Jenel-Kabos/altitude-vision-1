const FinancialSequence = require('../../models/FinancialSequence');
const { fail } = require('./financialError');

const DEFAULT_PREFIXES = { invoice: 'FAC', credit_note: 'AVO', proforma: 'PRO', receipt: 'REC' };
const sanitizeCode = (value) => String(value || '').replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(-8);

async function getNextFinancialDocumentNumber({ domain, establishmentType, establishmentId, documentType, year = new Date().getUTCFullYear(), prefix, establishmentCode, session }) {
  const effectivePrefix = sanitizeCode(prefix || DEFAULT_PREFIXES[documentType]);
  const code = sanitizeCode(establishmentCode || establishmentId);
  if (!effectivePrefix || !code) fail('FINANCIAL_SEQUENCE_ERROR', 'Configuration de séquence invalide.');
  const sequence = await FinancialSequence.findOneAndUpdate(
    { domain, establishmentType, establishmentId, documentType, year },
    { $inc: { currentValue: 1 }, $setOnInsert: { prefix: effectivePrefix } },
    { new: true, upsert: true, setDefaultsOnInsert: true, session },
  );
  const sequenceValue = sequence.currentValue;
  return { sequenceValue, formattedNumber: `${sequence.prefix}-${code}-${year}-${String(sequenceValue).padStart(6, '0')}` };
}
module.exports = { getNextFinancialDocumentNumber };
