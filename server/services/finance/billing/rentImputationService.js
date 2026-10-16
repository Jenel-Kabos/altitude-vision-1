// F-U2.12 — Imputation des paiements sur une échéance de loyer (règle
// validée, source unique pour la pénalité, le 1 % et la commission de 10 %) :
//   1. instruction explicite valide du paiement (`metadata.rentImputation`
//      ciblant ce document) ;
//   2. clause du bail (`Contrat.ordreImputation`) ;
//   3. à défaut : loyer principal avant les charges.
// Ordre de consommation : instructions explicites, puis allocations dans
// l'ordre des dates de CONFIRMATION (jamais la date d'allocation). Lecture
// seule : aucune allocation historique n'est réécrite.

const Contrat = require('../../../models/Contrat');
const FinancialDocumentLine = require('../../../models/FinancialDocumentLine');
const FinancialPayment = require('../../../models/FinancialPayment');
const PaymentAllocation = require('../../../models/PaymentAllocation');

const CONFIRMED_PAYMENT_STATUSES = ['succeeded', 'partially_refunded', 'refunded'];

async function documentObligations(document) {
  const lines = await FinancialDocumentLine.find({ financialDocument: document._id }).select('lineType totalMinor').lean();
  const rentMinor = lines.filter((line) => line.lineType === 'rent').reduce((sum, line) => sum + line.totalMinor, 0);
  const otherMinor = lines.reduce((sum, line) => sum + line.totalMinor, 0) - rentMinor;
  return { rentMinor, otherMinor };
}

// Parts loyer / autres de chaque allocation active d'un paiement confirmé
// (avant `at` si fourni ; `include(payment, allocation)` filtre en plus).
async function allocationRentShares(document, { at = null, include = null } = {}) {
  const { rentMinor, otherMinor } = await documentObligations(document);
  const lease = document.subjectType === 'Contrat' ? await Contrat.findById(document.subjectId).select('ordreImputation').lean() : null;
  // F-U2.13 — ordre stipulé par la politique du bail pour la période, sinon
  // clause historique du bail, sinon défaut technique « loyer d'abord ».
  const { policyForDocument } = require('./leasePolicyService'); // différé : évite un cycle
  const resolution = document.metadata?.period ? await policyForDocument(document) : null;
  const stipulated = resolution?.status === 'RESOLVED' ? resolution.terms?.imputation : null;
  const chargesFirst = stipulated ? stipulated === 'CHARGES_FIRST' : lease?.ordreImputation === 'charges_d_abord';
  const allocations = await PaymentAllocation.find({ financialDocument: document._id, status: 'active' }).lean();
  const payments = await FinancialPayment.find({ _id: { $in: allocations.map((a) => a.financialPayment) } }).select('status confirmedAt metadata').lean();
  const byId = new Map(payments.map((payment) => [String(payment._id), payment]));
  const eligible = allocations.filter((allocation) => {
    const payment = byId.get(String(allocation.financialPayment));
    if (!payment || !CONFIRMED_PAYMENT_STATUSES.includes(payment.status) || !payment.confirmedAt) return false;
    if (at && new Date(payment.confirmedAt) >= new Date(at)) return false;
    return include ? include(payment, allocation) : true;
  }).map((allocation) => {
    const payment = byId.get(String(allocation.financialPayment));
    const instruction = payment.metadata?.rentImputation;
    const explicit = instruction && String(instruction.financialDocument) === String(document._id) && Number.isSafeInteger(instruction.rentMinor) && instruction.rentMinor >= 0 && instruction.rentMinor <= allocation.amountMinor;
    return { allocation, payment, explicitRentMinor: explicit ? instruction.rentMinor : null };
  }).sort((x, y) => (x.explicitRentMinor == null) - (y.explicitRentMinor == null)
    || new Date(x.payment.confirmedAt) - new Date(y.payment.confirmedAt)
    || new Date(x.allocation.createdAt) - new Date(y.allocation.createdAt));
  let rentLeft = rentMinor; let otherLeft = otherMinor;
  const shares = eligible.map(({ allocation, payment, explicitRentMinor }) => {
    let rent; let rule;
    if (explicitRentMinor != null) { rent = Math.min(explicitRentMinor, rentLeft); rule = 'EXPLICIT_INSTRUCTION'; }
    else if (chargesFirst) { rent = Math.min(rentLeft, Math.max(0, allocation.amountMinor - otherLeft)); rule = 'CONTRACT_CHARGES_FIRST'; }
    else { rent = Math.min(rentLeft, allocation.amountMinor); rule = 'RENT_FIRST_DEFAULT'; }
    const other = Math.min(otherLeft, allocation.amountMinor - rent);
    rentLeft -= rent; otherLeft -= other;
    return { allocation: allocation._id, payment: payment._id, amountMinor: allocation.amountMinor, rentMinor: rent, otherMinor: other, rule, confirmedAt: payment.confirmedAt, allocatedAt: allocation.createdAt };
  });
  const rules = [...new Set(shares.map((share) => share.rule))];
  return { rentMinor, otherMinor, shares, imputation: rules.length ? rules.join('+') : 'NOTHING_PAID' };
}

module.exports = { allocationRentShares, documentObligations, CONFIRMED_PAYMENT_STATUSES };
