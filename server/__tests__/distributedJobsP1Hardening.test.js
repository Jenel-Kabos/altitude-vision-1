jest.mock('../models/Paiement', () => ({ findOneAndUpdate: jest.fn(), updateOne: jest.fn() }));
jest.mock('../services/zohoMailService', () => ({ sendEmail: jest.fn() }));
jest.mock('../models/Visite', () => ({ findOneAndUpdate: jest.fn() }));

const Paiement = require('../models/Paiement');
const mail = require('../services/zohoMailService');
const Visite = require('../models/Visite');
const { claimAndSendPenaltyEmail } = require('../services/alerteService');
const { expireVisitCandidate } = require('../services/visiteAutomationService');
const { buildStableMessageIdentity, checkpointAdvanceUpdate } = require('../services/zohoImapService');

describe('P1 distributed resource claims', () => {
  beforeEach(() => jest.clearAllMocks());

  test('deux pénalités concurrentes ne produisent qu’un email logique', async () => {
    const payment = { _id: 'p1', montant: 100000, mois: 8, annee: 2030, contrat: { locataire: { email: 'client@example.test', prenom: 'Ada', nom: 'Test' } } };
    Paiement.findOneAndUpdate.mockResolvedValueOnce({ ...payment }).mockResolvedValueOnce(null);
    Paiement.updateOne.mockResolvedValue({ modifiedCount: 1 });
    mail.sendEmail.mockResolvedValue({ success: true });
    const results = await Promise.all([
      claimAndSendPenaltyEmail({ paiement: payment, penalite: 3000, retardJours: 6, now: new Date('2030-08-07') }),
      claimAndSendPenaltyEmail({ paiement: payment, penalite: 3000, retardJours: 6, now: new Date('2030-08-07') }),
    ]);
    expect(results.filter(({ sent }) => sent)).toHaveLength(1);
    expect(mail.sendEmail).toHaveBeenCalledTimes(1);
  });

  test('expiration visite utilise un CAS et ne peut écraser une confirmation concurrente', async () => {
    Visite.findOneAndUpdate.mockResolvedValueOnce(null);
    const result = await expireVisitCandidate({ _id: 'v1', status: 'demandee', requestedDate: new Date('2030-01-01') }, new Date('2030-01-02'));
    expect(result).toBeNull();
    expect(Visite.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'v1', status: 'demandee', requestedDate: { $lt: expect.any(Date) } }),
      expect.any(Object),
      expect.objectContaining({ new: true }),
    );
  });

  test('identité IMAP fallback est déterministe et checkpoint strictement monotone', () => {
    const input = { account: 'inbox@example.test', mailbox: 'INBOX', uidValidity: '123', uid: 456 };
    expect(buildStableMessageIdentity(input)).toBe(buildStableMessageIdentity(input));
    expect(buildStableMessageIdentity(input)).toContain('123');
    expect(checkpointAdvanceUpdate({ uidValidity: '123', lastProcessedUid: 200 })).toEqual(expect.objectContaining({ $max: { lastProcessedUid: 200 } }));
  });
});
