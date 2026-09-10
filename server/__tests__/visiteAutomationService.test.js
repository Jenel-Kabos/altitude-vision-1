jest.mock('../models/Visite', () => ({
  find: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));
jest.mock('../services/notificationService', () => ({
  notify: jest.fn().mockResolvedValue({}),
  notifyStaff: jest.fn().mockResolvedValue({}),
}));

const Visite = require('../models/Visite');
const { notify, notifyStaff } = require('../services/notificationService');
const { processVisitAutomation, POST_SCHEDULED_EXPIRY_MS } = require('../services/visiteAutomationService');

const queryWith = (value) => ({ populate: jest.fn().mockResolvedValue(value) });

// Trois branches successives interrogent Visite.find dans processVisitAutomation :
// 1. reminders           — status=CONFIRMED,     scheduledStartAt: { $gt: now, $lte: horizon }  (chainé .populate)
// 2. legacy expiry       — status ∈ REQUESTED/AWAITING, requestedDate: { $lt: now }             (array direct)
// 3. auto-expire 3h      — status=CONFIRMED,     scheduledStartAt: { $lte: now - 3h }           (chainé .populate)
// Le routage par forme de filtre isole chaque branche des autres tests.
const routedFind = ({ reminders = [], legacyExpired = [], staleConfirmed = [] } = {}) => (query) => {
  if (query.scheduledStartAt?.$gt) return queryWith(reminders);
  if (query.scheduledStartAt?.$lte && !query.scheduledStartAt.$gt) return queryWith(staleConfirmed);
  if (query.requestedDate?.$lt) return legacyExpired;
  return [];
};

describe('visiteAutomationService — rappels & legacy expiry — TEST DATA', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Visite.findOneAndUpdate.mockResolvedValue({ _id: 'TEST-DATA-VISIT' });
  });

  test.each([
    ['twentyFourHours', 23 * 60 * 60 * 1000],
    ['twoHours', 90 * 60 * 1000],
    ['thirtyMinutes', 20 * 60 * 1000],
  ])('envoie le rappel %s une seule fois', async (key, offset) => {
    const now = new Date('2030-01-01T00:00:00.000Z');
    const visite = {
      _id: { toString: () => 'TEST-DATA-VISIT' }, client: 'TEST-DATA-CLIENT',
      status: 'confirmee', scheduledStartAt: new Date(now.getTime() + offset),
      reminderStates: { twentyFourHours: key !== 'twentyFourHours', twoHours: key !== 'twoHours', thirtyMinutes: key !== 'thirtyMinutes' },
      property: { title: 'TEST DATA PROPERTY', owner: 'TEST-DATA-OWNER' },
    };
    Visite.find.mockImplementation(routedFind({ reminders: [visite] }));
    const result = await processVisitAutomation(now);
    expect(result.reminders).toBe(1);
    expect(Visite.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ [`reminderStates.${key}`]: { $ne: true } }),
      { $set: { [`reminderStates.${key}`]: true } },
      { new: true },
    );
    expect(notify).toHaveBeenCalledTimes(2);
  });

  test('une visite annulée ou terminée est exclue par la requête', async () => {
    Visite.find.mockImplementation(routedFind({}));
    const result = await processVisitAutomation(new Date('2030-01-01T00:00:00.000Z'));
    expect(result.reminders).toBe(0);
    expect(Visite.find.mock.calls[0][0]).toMatchObject({ status: 'confirmee' });
    expect(Visite.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('deux exécutions concurrentes ne réservent le même rappel qu\'une fois', async () => {
    const now = new Date('2030-01-01T00:00:00.000Z');
    const visite = {
      _id: { toString: () => 'TEST-DATA-VISIT' }, client: 'TEST-DATA-CLIENT',
      status: 'confirmee', scheduledStartAt: new Date(now.getTime() + 20 * 60 * 1000),
      reminderStates: { twentyFourHours: true, twoHours: true, thirtyMinutes: false },
      property: { title: 'TEST DATA PROPERTY', owner: 'TEST-DATA-OWNER' },
    };
    Visite.find.mockImplementation(routedFind({ reminders: [visite] }));
    Visite.findOneAndUpdate.mockResolvedValueOnce({ _id: visite._id }).mockResolvedValueOnce(null);
    const results = await Promise.all([processVisitAutomation(now), processVisitAutomation(now)]);
    expect(results.map((result) => result.reminders).sort()).toEqual([0, 1]);
    expect(notify).toHaveBeenCalledTimes(2);
  });
});

describe('visiteAutomationService — auto-clôture 3h post-scheduledStartAt (VISITS-AUTO-EXPIRY-1)', () => {
  const now = new Date('2030-01-01T12:00:00.000Z');
  const staleCutoffMs = now.getTime() - POST_SCHEDULED_EXPIRY_MS; // now - 3h

  const buildVisite = ({ id = 'STALE-1', scheduledStartAt, owner = 'OWNER-A', client = 'CLIENT-A' } = {}) => ({
    _id: { toString: () => id },
    client, status: 'confirmee', scheduledStartAt,
    reminderStates: {}, property: { title: 'TEST DATA PROPERTY', owner },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    Visite.findOneAndUpdate.mockResolvedValue({ _id: 'STALE-1' });
  });

  test('cible bien status=confirmee et scheduledStartAt <= now - 3h', async () => {
    Visite.find.mockImplementation(routedFind({}));
    await processVisitAutomation(now);
    const staleCall = Visite.find.mock.calls.find(([q]) => q.scheduledStartAt?.$lte && !q.scheduledStartAt?.$gt);
    expect(staleCall[0]).toMatchObject({ status: 'confirmee' });
    expect(staleCall[0].scheduledStartAt.$lte.getTime()).toBe(staleCutoffMs);
  });

  test('visite dépassée de 3h+ → status=expiree, cancellationReason=auto_no_show, actor=cron, workflowHistory poussé', async () => {
    const visite = buildVisite({ scheduledStartAt: new Date(now.getTime() - 3 * 60 * 60 * 1000) });
    Visite.find.mockImplementation(routedFind({ staleConfirmed: [visite] }));
    const result = await processVisitAutomation(now);
    expect(result.autoExpired).toBe(1);
    const [filter, update] = Visite.findOneAndUpdate.mock.calls[0];
    expect(filter).toMatchObject({ status: 'confirmee', scheduledStartAt: { $lte: expect.any(Date) } });
    expect(update.$set).toMatchObject({
      status: 'expiree', cancellationActor: 'cron', cancellationReason: 'auto_no_show',
    });
    expect(update.$set.cancelledAt).toEqual(now);
    expect(update.$push.workflowHistory).toMatchObject({
      from: 'confirmee', to: 'expiree', action: 'auto_expire_post_scheduled', source: 'cron', role: 'system',
    });
  });

  test('visite à +2h59 (encore dans la fenêtre de tolérance) n\'est PAS retournée par la requête', async () => {
    const twoHFiftyNine = new Date(now.getTime() - (2 * 60 + 59) * 60 * 1000);
    Visite.find.mockImplementation((query) => {
      if (query.scheduledStartAt?.$lte && !query.scheduledStartAt?.$gt) {
        // Simule le filtre MongoDB : la visite à -2h59 n'est PAS <= now - 3h.
        const cutoff = query.scheduledStartAt.$lte.getTime();
        return queryWith(twoHFiftyNine.getTime() <= cutoff ? [buildVisite({ scheduledStartAt: twoHFiftyNine })] : []);
      }
      return routedFind({})(query);
    });
    const result = await processVisitAutomation(now);
    expect(result.autoExpired).toBe(0);
    expect(Visite.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('visite terminée ou déjà annulée → exclue par le filtre status:confirmee', async () => {
    Visite.find.mockImplementation(routedFind({ staleConfirmed: [] }));
    const result = await processVisitAutomation(now);
    expect(result.autoExpired).toBe(0);
  });

  test('client et propriétaire notifiés + résumé staff quand au moins une visite est expirée', async () => {
    const v = buildVisite({ scheduledStartAt: new Date(now.getTime() - 4 * 60 * 60 * 1000), client: 'CLIENT-XYZ', owner: 'OWNER-XYZ' });
    Visite.find.mockImplementation(routedFind({ staleConfirmed: [v] }));
    await processVisitAutomation(now);
    const recipients = notify.mock.calls.map((c) => c[0].recipient);
    expect(recipients).toEqual(expect.arrayContaining(['CLIENT-XYZ', 'OWNER-XYZ']));
    expect(notifyStaff).toHaveBeenCalledWith(expect.objectContaining({ type: 'visite_status', title: 'Visites clôturées automatiquement' }));
  });

  test('idempotent : deux crons concurrents ne clôturent la même visite qu\'une seule fois', async () => {
    const v = buildVisite({ scheduledStartAt: new Date(now.getTime() - 4 * 60 * 60 * 1000) });
    Visite.find.mockImplementation(routedFind({ staleConfirmed: [v] }));
    // Premier cron gagne, second cron perd la course atomique (guard status:CONFIRMED).
    Visite.findOneAndUpdate.mockResolvedValueOnce({ _id: v._id }).mockResolvedValueOnce(null);
    const results = await Promise.all([processVisitAutomation(now), processVisitAutomation(now)]);
    expect(results.map((r) => r.autoExpired).sort()).toEqual([0, 1]);
    // Notifications émises une seule fois (client + owner).
    expect(notify).toHaveBeenCalledTimes(2);
    expect(notifyStaff).toHaveBeenCalledTimes(1);
  });

  test('aucune visite éligible → aucun findOneAndUpdate, aucun notifyStaff pour l\'auto-expiry', async () => {
    Visite.find.mockImplementation(routedFind({}));
    const result = await processVisitAutomation(now);
    expect(result.autoExpired).toBe(0);
    expect(Visite.findOneAndUpdate).not.toHaveBeenCalled();
    expect(notifyStaff).not.toHaveBeenCalled();
  });
});
