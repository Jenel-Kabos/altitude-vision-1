// F-U1.C — Réservations atomiques sur FinancialLimitCounter.
//
// Toutes les opérations de réservation s'exécutent dans une transaction
// MongoDB (session obligatoire) : une écriture concurrente sur le même
// compteur provoque un WriteConflict, la transaction est rejouée et relit
// l'état à jour. Le plafond est fourni par l'appelant depuis son snapshot.

const FinancialLimitCounter = require('../../../models/FinancialLimitCounter');
const { fail } = require('../financialError');
const { assertAmountMinor } = require('../moneyService');

const requireSession = (session) => {
  if (!session) fail('FINANCIAL_TRANSACTION_REQUIRED', 'Une transaction MongoDB est requise pour réserver un plafond.', 500);
};

// Création hors transaction (upsert idempotent) pour éviter les conflits
// d'insertion concurrente à l'intérieur des transactions.
async function ensureCounters(entries) {
  await Promise.all(entries.map(({ key, scopeType }) => FinancialLimitCounter.updateOne(
    { key }, { $setOnInsert: { key, scopeType, reservedMinor: 0, revision: 0 } }, { upsert: true },
  ).catch((error) => { if (error?.code !== 11000) throw error; })));
}

async function readReserved(key, session) {
  requireSession(session);
  const counter = await FinancialLimitCounter.findOne({ key }).session(session).lean();
  return counter?.reservedMinor || 0;
}

async function tryReserve({ key, amountMinor, capMinor, session }) {
  requireSession(session);
  assertAmountMinor(amountMinor); assertAmountMinor(capMinor);
  return FinancialLimitCounter.findOneAndUpdate(
    { key, $expr: { $lte: [{ $add: ['$reservedMinor', amountMinor] }, capMinor] } },
    { $inc: { reservedMinor: amountMinor, revision: 1 } },
    { new: true, session },
  );
}

// Réservation hors plafond : uniquement après autorisation effective du
// propriétaire pour CETTE dépense.
async function forceReserve({ key, amountMinor, session }) {
  requireSession(session);
  assertAmountMinor(amountMinor);
  const counter = await FinancialLimitCounter.findOneAndUpdate({ key }, { $inc: { reservedMinor: amountMinor, revision: 1 } }, { new: true, session });
  if (!counter) fail('FINANCIAL_COUNTER_MISSING', 'Compteur de plafond introuvable.', 500);
  return counter;
}

async function release({ key, amountMinor, session }) {
  requireSession(session);
  assertAmountMinor(amountMinor);
  if (amountMinor === 0) return null;
  const counter = await FinancialLimitCounter.findOneAndUpdate(
    { key, reservedMinor: { $gte: amountMinor } },
    { $inc: { reservedMinor: -amountMinor, revision: 1 } },
    { new: true, session },
  );
  if (!counter) fail('FINANCIAL_COUNTER_UNDERFLOW', 'Libération supérieure au montant réservé.', 500);
  return counter;
}

// Verrou transactionnel : sérialise les transactions qui touchent la même clé.
async function lock({ key, session }) {
  requireSession(session);
  const counter = await FinancialLimitCounter.findOneAndUpdate({ key }, { $inc: { revision: 1 } }, { new: true, session });
  if (!counter) fail('FINANCIAL_COUNTER_MISSING', 'Compteur de verrouillage introuvable.', 500);
  return counter;
}

module.exports = { ensureCounters, readReserved, tryReserve, forceReserve, release, lock };
