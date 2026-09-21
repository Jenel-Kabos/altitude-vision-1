const Deduction = require('../../models/FinancialDeduction');
const Reservation = require('../../models/AccommodationReservation');
const { appendFinancialLedgerEntry } = require('./financialLedgerService');
const { fail } = require('./financialError');

const id = (value) => value?.id || value?._id || value;
const applicableStatuses = ['approved', 'applied'];
const calculateDeductionImpact = ({ validatedPaidAmount, consumedStayAmount, alreadyRefundedAmount = 0, alreadyReservedForRefundAmount = 0, validatedDeductions = 0 }) => {
  const futurePaidRefundable = Math.max(0, Number(validatedPaidAmount || 0) - Number(consumedStayAmount || 0) - Number(alreadyRefundedAmount || 0) - Number(alreadyReservedForRefundAmount || 0));
  const appliedDeductions = Math.min(futurePaidRefundable, Math.max(0, Number(validatedDeductions || 0)));
  return { futurePaidRefundable, validatedDeductions: Math.max(0, Number(validatedDeductions || 0)), appliedDeductions, finalRefund: Math.max(0, futurePaidRefundable - appliedDeductions), remainingClaim: Math.max(0, Number(validatedDeductions || 0) - appliedDeductions) };
};

async function report({ reservation, category, description, reportedAmountMinor, evidence = [], actor, businessOperationKey }) {
  const amount = Number(reportedAmountMinor);
  if (!Number.isSafeInteger(amount) || amount <= 0) fail('FINANCIAL_DEDUCTION_AMOUNT_INVALID', 'Montant signale invalide.', 422);
  if (!businessOperationKey) fail('FINANCIAL_IDEMPOTENCY_KEY_REQUIRED', 'Cle idempotence requise.', 422);
  const key = `accommodation-deduction:${reservation._id}:${businessOperationKey}`;
  let deduction = await Deduction.findOne({ tenant: reservation.tenant, businessOperationKey: key });
  if (deduction) return deduction;
  deduction = new Deduction({ tenant: reservation.tenant, reservation: reservation._id, accommodation: reservation.accommodation, client: reservation.guest, category, description, reportedAmountMinor: amount, evidence, createdBy: id(actor), businessOperationKey: key });
  try { await deduction.save(); } catch (error) { if (error?.code === 11000) return Deduction.findOne({ tenant: reservation.tenant, businessOperationKey: key }); throw error; }
  await appendFinancialLedgerEntry({ eventType: 'deduction.reported', domain: 'real_estate', establishmentType: 'Accommodation', establishmentId: reservation.accommodation, entityType: 'FinancialDeduction', entityId: deduction._id, relatedEntities: [{ entityType: 'AccommodationReservation', entityId: reservation._id }], actorType: 'user', actorId: id(actor), amountMinor: amount, currency: 'XAF', businessOperationKey: `${key}:ledger`, newState: { status: 'pending_validation', category } });
  return deduction;
}

async function validate({ deductionId, approved, approvedAmountMinor, reason, actor, businessOperationKey }) {
  const current = await Deduction.findById(deductionId); if (!current) fail('FINANCIAL_DEDUCTION_NOT_FOUND', 'Retenue introuvable.', 404);
  if (current.status !== 'pending_validation') return current;
  const amount = approved ? Number(approvedAmountMinor ?? current.reportedAmountMinor) : 0;
  if (approved && (!Number.isSafeInteger(amount) || amount < 0 || amount > current.reportedAmountMinor)) fail('FINANCIAL_DEDUCTION_AMOUNT_INVALID', 'Montant approuve invalide.', 422);
  const update = approved ? { status: 'approved', approvedAmountMinor: amount, validatedBy: id(actor), validatedAt: new Date() } : { status: 'rejected', approvedAmountMinor: 0, rejectedBy: id(actor), rejectedAt: new Date(), rejectionReason: reason || 'Rejet financier' };
  const deduction = await Deduction.findOneAndUpdate({ _id: deductionId, status: 'pending_validation' }, { $set: update }, { new: true });
  if (!deduction) return Deduction.findById(deductionId);
  await appendFinancialLedgerEntry({ eventType: approved ? 'deduction.approved' : 'deduction.rejected', domain: 'real_estate', establishmentType: 'Accommodation', establishmentId: deduction.accommodation, entityType: 'FinancialDeduction', entityId: deduction._id, relatedEntities: [{ entityType: 'AccommodationReservation', entityId: deduction.reservation }], actorType: 'user', actorId: id(actor), amountMinor: approved ? amount : 0, currency: 'XAF', businessOperationKey: `${businessOperationKey}:ledger`, previousState: { status: 'pending_validation' }, newState: { status: deduction.status, approvedAmountMinor: amount } });
  return deduction;
}

async function summary(reservationId) {
  const reservation = await Reservation.findById(reservationId); if (!reservation) fail('FINANCIAL_DEDUCTION_NOT_FOUND', 'Reservation introuvable.', 404);
  const deductions = await Deduction.find({ reservation: reservation._id }).sort({ createdAt: 1 }).lean();
  const validatedDeductions = deductions.filter((item) => applicableStatuses.includes(item.status)).reduce((sum, item) => sum + Number(item.approvedAmountMinor || 0), 0);
  return { reservation, deductions, validatedDeductions };
}

async function applyApproved({ reservationId, maximumMinor }) {
  const rows = await Deduction.find({ reservation: reservationId, status: { $in: applicableStatuses } }).sort({ createdAt: 1 });
  let remaining = Math.max(0, Number(maximumMinor || 0)); let applied = 0;
  for (const row of rows) {
    const amount = Math.min(remaining, Number(row.approvedAmountMinor || 0)); remaining -= amount; applied += amount;
    if (row.status !== 'applied' || row.appliedAmountMinor !== amount) await Deduction.updateOne({ _id: row._id }, { $set: { status: 'applied', appliedAmountMinor: amount, appliedAt: new Date() } });
  }
  return applied;
}

module.exports = { applicableStatuses, calculateDeductionImpact, report, validate, summary, applyApproved };
