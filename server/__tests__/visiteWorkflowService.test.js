const {
  STATUS, normalizeStatus, canTransition, actionsFor, appendHistory, resetReminderStates, serializeVisite, maskPhone,
} = require('../services/visiteWorkflowService');

describe('visiteWorkflowService — TEST DATA', () => {
  test('normalise les anciennes valeurs sans casser les documents existants', () => {
    expect(normalizeStatus(null, 'Confirmée')).toBe(STATUS.CONFIRMED);
    expect(normalizeStatus(null, 'En attente')).toBe(STATUS.REQUESTED);
  });

  test('autorise le parcours nominal et refuse une réouverture implicite', () => {
    expect(canTransition(STATUS.REQUESTED, STATUS.CONFIRMED)).toBe(true);
    expect(canTransition(STATUS.CONFIRMED, STATUS.IN_PROGRESS)).toBe(true);
    expect(canTransition(STATUS.COMPLETED, STATUS.REQUESTED)).toBe(false);
    expect(canTransition(STATUS.CANCELLED_STAFF, STATUS.IN_PROGRESS)).toBe(false);
  });

  test.each([
    [STATUS.REQUESTED, STATUS.CONFIRMED],
    [STATUS.CONFIRMED, STATUS.IN_PROGRESS],
    [STATUS.IN_PROGRESS, STATUS.COMPLETED],
    [STATUS.CONFIRMED, STATUS.CLIENT_ABSENT],
    [STATUS.CONFIRMED, STATUS.OWNER_CANCELLATION_REQUESTED],
    [STATUS.OWNER_CANCELLATION_REQUESTED, STATUS.CANCELLED_OWNER],
    [STATUS.OWNER_CANCELLATION_REQUESTED, STATUS.CONFIRMED],
    [STATUS.RESCHEDULED, STATUS.CONFIRMED],
  ])('autorise %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  test('calcule les actions propriétaire et client depuis le backend', () => {
    expect(actionsFor(STATUS.CONFIRMED, 'owner')).toEqual(expect.arrayContaining(['start', 'client_absent', 'request_cancellation']));
    expect(actionsFor(STATUS.IN_PROGRESS, 'owner')).toContain('complete');
    expect(actionsFor(STATUS.COMPLETED, 'client')).toEqual([]);
  });

  test('ajoute un historique append-only et maintient le statut historique', () => {
    const visite = { status: STATUS.CONFIRMED, statut: 'Confirmée', workflowHistory: [] };
    appendHistory(visite, { to: STATUS.IN_PROGRESS, action: 'start', role: 'owner', source: 'mobile' });
    expect(visite).toMatchObject({ status: STATUS.IN_PROGRESS, statut: 'En cours' });
    expect(visite.workflowHistory).toHaveLength(1);
    expect(visite.workflowHistory[0]).toMatchObject({ from: STATUS.CONFIRMED, to: STATUS.IN_PROGRESS, source: 'mobile' });
  });

  test('masque le téléphone client au propriétaire avant consentement et confirmation', () => {
    const base = { _id: 'TEST DATA', status: STATUS.REQUESTED, clientPhoneSnapshot: '+242000000000', clientContactConsent: true, client: { _id: 'CLIENT', name: 'TEST DATA CLIENT', phone: '+242000000000', email: 'test@example.com' } };
    const pending = serializeVisite(base, 'owner');
    expect(pending.telephone).toBe(maskPhone(base.clientPhoneSnapshot));
    expect(pending.client).toEqual({ _id: 'CLIENT', name: 'TEST DATA CLIENT' });
    const confirmed = serializeVisite({ ...base, status: STATUS.CONFIRMED }, 'owner');
    expect(confirmed.telephone).toBe(base.clientPhoneSnapshot);
  });

  test('masque adresse et contact propriétaire au client avant confirmation', () => {
    const visite = serializeVisite({ status: STATUS.REQUESTED, meetingAddressSnapshot: 'TEST DATA PRIVATE ADDRESS', coordinatesSnapshot: { lat: -4, lng: 15 }, ownerPhoneSnapshot: '+242000000000' }, 'client');
    expect(visite.meetingAddressSnapshot).toBe('');
    expect(visite.coordinatesSnapshot).toBeNull();
    expect(visite.ownerPhoneSnapshot).toBeUndefined();
  });

  test('une reprogrammation recalcule tous les rappels avec une nouvelle version', () => {
    const visite = { reminderStates: { twentyFourHours: true, twoHours: true, thirtyMinutes: false, scheduleVersion: 3 } };
    expect(resetReminderStates(visite)).toEqual({ twentyFourHours: false, twoHours: false, thirtyMinutes: false, scheduleVersion: 4 });
  });

  test.each([
    [STATUS.COMPLETED], [STATUS.CANCELLED_CLIENT], [STATUS.CANCELLED_OWNER],
    [STATUS.CANCELLED_STAFF], [STATUS.REFUSED], [STATUS.CLIENT_ABSENT],
    [STATUS.OWNER_ABSENT], [STATUS.EXPIRED],
  ])('%s est terminal', (status) => {
    expect(actionsFor(status, 'client')).toEqual([]);
    expect(actionsFor(status, 'owner')).toEqual([]);
    expect(actionsFor(status, 'staff')).toEqual([]);
  });
});
