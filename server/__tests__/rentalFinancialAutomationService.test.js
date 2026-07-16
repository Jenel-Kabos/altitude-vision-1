jest.mock('../models/Paiement', () => ({ find: jest.fn() }));
jest.mock('../models/Contrat', () => ({ find: jest.fn() }));
jest.mock('../models/RentalManagement', () => ({ find: jest.fn() }));
jest.mock('../services/notificationService', () => ({
  notify: jest.fn().mockResolvedValue({ _id: 'owner-notification' }),
  notifyStaff: jest.fn().mockResolvedValue(undefined),
}));

const mongoose = require('mongoose');
const Paiement = require('../models/Paiement');
const Contrat = require('../models/Contrat');
const RentalManagement = require('../models/RentalManagement');
const notifications = require('../services/notificationService');
const automation = require('../services/rentalFinancialAutomationService');

const paymentId = new mongoose.Types.ObjectId();
const contractId = new mongoose.Types.ObjectId();
const rentalId = new mongoose.Types.ObjectId();
const propertyId = new mongoose.Types.ObjectId();
const ownerId = new mongoose.Types.ObjectId();
const chain = (rows) => ({ select: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(rows) })) });

const activeContext = ({ payments = [], contracts, rentals } = {}) => {
  Paiement.find.mockReturnValue(chain(payments));
  Contrat.find.mockReturnValue(chain(contracts ?? [{ _id: contractId, bien: propertyId, statut: 'actif', dateFinBail: new Date('2026-07-25') }]));
  RentalManagement.find.mockReturnValue(chain(rentals ?? [{ _id: rentalId, property: propertyId, owner: ownerId, activeLease: contractId }]));
};

describe('rentalFinancialAutomationService', () => {
  beforeEach(() => jest.clearAllMocks());

  test('détecte un impayé réellement échu avec solde positif', async () => {
    activeContext({ payments: [{ _id: paymentId, contrat: contractId, mois: 6, annee: 2026, jourEcheance: 5, montant: 200000, statut: 'impayé' }] });
    const result = await automation.checkRentalPaymentOverdues({ now: new Date('2026-07-16T12:00:00Z') });
    expect(result).toEqual(expect.objectContaining({ overdue: 1, partial: 0, notified: 1 }));
    expect(notifications.notify).toHaveBeenCalledWith(expect.objectContaining({
      recipient: ownerId,
      dedupeKey: `rental_payment_overdue:${paymentId}:2026-06-05`,
    }));
  });

  test('distingue un paiement partiel du défaut total', async () => {
    activeContext({ payments: [{ _id: paymentId, contrat: contractId, mois: 6, annee: 2026, jourEcheance: 1, montant: 200000, montantRecu: 50000, statut: 'partiel' }] });
    const result = await automation.checkRentalPaymentOverdues({ now: new Date('2026-07-16') });
    expect(result.partial).toBe(1);
    expect(notifications.notify).toHaveBeenCalledWith(expect.objectContaining({ title: 'Paiement de loyer partiel' }));
  });

  test('ignore échéance future, paiement sans solde et contrat inactif/ancien', async () => {
    activeContext({
      payments: [
        { _id: paymentId, contrat: contractId, mois: 8, annee: 2026, montant: 200000, statut: 'impayé' },
        { _id: new mongoose.Types.ObjectId(), contrat: contractId, mois: 6, annee: 2026, montant: 200000, montantRecu: 200000, statut: 'partiel' },
      ],
      contracts: [], rentals: [],
    });
    const result = await automation.checkRentalPaymentOverdues({ now: new Date('2026-07-16') });
    expect(result.notified).toBe(0);
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(Contrat.find).toHaveBeenCalledWith(expect.objectContaining({ type: 'location', statut: 'actif' }));
    expect(Paiement.find).toHaveBeenCalledWith({ statut: { $in: ['impayé', 'en_retard', 'partiel'] } });
  });

  test('alerte uniquement le contrat actif courant dans la fenêtre configurable', async () => {
    activeContext({ payments: [], contracts: [{ _id: contractId, bien: propertyId, statut: 'actif', dateFinBail: new Date('2026-07-25') }] });
    const result = await automation.checkRentalContractsExpiring({ now: new Date('2026-07-16'), windowDays: 15 });
    expect(result).toEqual(expect.objectContaining({ expiring: 1, notified: 1, windowDays: 15 }));
    expect(notifications.notify).toHaveBeenCalledWith(expect.objectContaining({
      dedupeKey: `rental_contract_expiring:${contractId}:2026-07-25:15`,
    }));
    expect(Contrat.find).toHaveBeenCalledWith(expect.objectContaining({
      type: 'location', statut: 'actif', dateFinBail: expect.objectContaining({ $gt: expect.any(Date), $lte: expect.any(Date) }),
    }));
  });

  test('contrat renouvelé non actif, expiré, sans date ou sans dossier courant est ignoré par la requête ou le rapprochement', async () => {
    activeContext({ payments: [], contracts: [{ _id: contractId, dateFinBail: new Date('2026-07-20'), statut: 'actif' }], rentals: [] });
    const result = await automation.checkRentalContractsExpiring({ now: new Date('2026-07-16'), windowDays: 30 });
    expect(result).toEqual(expect.objectContaining({ notified: 0, ignored: 1 }));
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  test('deux exécutions produisent exactement la même clé métier atomique', async () => {
    activeContext({ payments: [{ _id: paymentId, contrat: contractId, mois: 6, annee: 2026, jourEcheance: 5, montant: 200000, statut: 'en_retard' }] });
    await Promise.all([
      automation.checkRentalPaymentOverdues({ now: new Date('2026-07-16') }),
      automation.checkRentalPaymentOverdues({ now: new Date('2026-07-16') }),
    ]);
    const keys = notifications.notify.mock.calls.map(([payload]) => payload.dedupeKey);
    expect(new Set(keys)).toEqual(new Set([`rental_payment_overdue:${paymentId}:2026-06-05`]));
  });
});
