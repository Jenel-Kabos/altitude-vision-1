const FinancialLedgerEntry = require('../../models/FinancialLedgerEntry');

const SENSITIVE_KEYS = /token|secret|signature|password|payload|providerMetadata/i;
function sanitize(value) {
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !SENSITIVE_KEYS.test(key)).map(([key, item]) => [key, sanitize(item)]));
}
async function appendFinancialLedgerEntry(data, { session } = {}) {
  const [entry] = await FinancialLedgerEntry.create([{ ...data, metadata: sanitize(data.metadata || {}) }], { session });
  return entry;
}
module.exports = { appendFinancialLedgerEntry, sanitizeFinancialMetadata: sanitize };
