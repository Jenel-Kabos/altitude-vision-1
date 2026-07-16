const Paiement = require('../models/Paiement');
const Contrat = require('../models/Contrat');
const RentalManagement = require('../models/RentalManagement');
const { notify, notifyStaff } = require('./notificationService');

const positiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const contractAlertWindowDays = () => positiveInteger(process.env.RENTAL_CONTRACT_EXPIRY_ALERT_DAYS, 30);

const paymentDueDate = (payment) => {
  const year = Number(payment.annee);
  const month = Number(payment.mois);
  const day = Math.min(28, Math.max(1, Number(payment.jourEcheance) || 1));
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;
  return new Date(year, month - 1, day, 23, 59, 59, 999);
};

const remainingAmount = (payment) => {
  const expected = Number(payment.montantTotal ?? payment.montant ?? 0);
  const received = Number(payment.montantRecu ?? 0);
  return Math.max(0, expected - received);
};

const notifyFinancialAlert = async ({ rental, type, title, body, dedupeKey }) => {
  const payload = {
    type, title, body, dedupeKey,
    entityType: 'RentalManagement', entityId: rental._id,
    data: {
      rentalManagementId: rental._id,
      propertyId: rental.property,
      eventType: type,
      updatedAt: new Date(),
    },
  };
  return Promise.allSettled([
    notifyStaff(payload),
    rental.owner ? notify({ ...payload, recipient: rental.owner, link: '/mes-biens' }) : Promise.resolve(),
  ]);
};

const checkRentalPaymentOverdues = async ({ now = new Date() } = {}) => {
  const payments = await Paiement.find({ statut: { $in: ['impayé', 'en_retard', 'partiel'] } })
    .select('_id contrat mois annee jourEcheance montant montantTotal montantRecu statut')
    .lean();
  const contractIds = [...new Set(payments.map((payment) => String(payment.contrat)).filter(Boolean))];
  const contracts = await Contrat.find({ _id: { $in: contractIds }, type: 'location', statut: 'actif' })
    .select('_id bien statut').lean();
  const contractMap = new Map(contracts.map((contract) => [String(contract._id), contract]));
  const rentals = await RentalManagement.find({ active: true, activeLease: { $in: contracts.map((contract) => contract._id) } })
    .select('_id property owner activeLease').lean();
  const rentalMap = new Map(rentals.map((rental) => [String(rental.activeLease), rental]));
  const result = { checked: payments.length, overdue: 0, partial: 0, notified: 0, ignored: 0, errors: 0 };

  for (const payment of payments) {
    const contract = contractMap.get(String(payment.contrat));
    const rental = contract && rentalMap.get(String(contract._id));
    const dueDate = paymentDueDate(payment);
    const remaining = remainingAmount(payment);
    if (!contract || !rental || !dueDate || dueDate >= now || remaining <= 0 || payment.statut === 'payé') {
      result.ignored += 1; continue;
    }
    const partial = payment.statut === 'partiel' || Number(payment.montantRecu || 0) > 0;
    result[partial ? 'partial' : 'overdue'] += 1;
    const dedupeKey = `rental_payment_overdue:${payment._id}:${dueDate.toISOString().slice(0, 10)}`;
    try {
      await notifyFinancialAlert({
        rental, type: 'rental_payment_overdue', dedupeKey,
        title: partial ? 'Paiement de loyer partiel' : 'Loyer en retard',
        body: partial ? 'Un solde de loyer reste à régulariser.' : 'Une échéance de loyer arrivée à terme reste impayée.',
      });
      result.notified += 1;
    } catch { result.errors += 1; }
  }
  return result;
};

const checkRentalContractsExpiring = async ({ now = new Date(), windowDays = contractAlertWindowDays() } = {}) => {
  const cutoff = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000);
  const contracts = await Contrat.find({
    type: 'location', statut: 'actif', dateFinBail: { $gt: now, $lte: cutoff },
  }).select('_id bien dateFinBail statut').lean();
  const rentals = await RentalManagement.find({ active: true, activeLease: { $in: contracts.map((contract) => contract._id) } })
    .select('_id property owner activeLease').lean();
  const rentalMap = new Map(rentals.map((rental) => [String(rental.activeLease), rental]));
  const result = { checked: contracts.length, expiring: 0, notified: 0, ignored: 0, errors: 0, windowDays };

  for (const contract of contracts) {
    const rental = rentalMap.get(String(contract._id));
    if (!rental || !contract.dateFinBail) { result.ignored += 1; continue; }
    result.expiring += 1;
    const endDate = new Date(contract.dateFinBail);
    const dedupeKey = `rental_contract_expiring:${contract._id}:${endDate.toISOString().slice(0, 10)}:${windowDays}`;
    try {
      await notifyFinancialAlert({
        rental, type: 'rental_contract_expiring', dedupeKey,
        title: 'Contrat locatif arrivant à expiration',
        body: `Un contrat actif arrive à expiration dans la fenêtre configurée de ${windowDays} jours.`,
      });
      result.notified += 1;
    } catch { result.errors += 1; }
  }
  return result;
};

const runRentalFinancialAutomations = async (options = {}) => {
  const [payments, contracts] = await Promise.all([
    checkRentalPaymentOverdues(options),
    checkRentalContractsExpiring(options),
  ]);
  return { payments, contracts };
};

module.exports = {
  paymentDueDate, remainingAmount, contractAlertWindowDays,
  checkRentalPaymentOverdues, checkRentalContractsExpiring, runRentalFinancialAutomations,
};
