// __tests__/rentalMaintenanceService.test.js — Sprint GL-B2
// Domaine dédié à la maintenance LOCATIVE (distinct du maintenanceService
// hôtelier, Sprint E).

jest.mock('../models/RentalMaintenanceTicket');
// Dette technique GL-B2 (Mission 6) — synchronisation de
// RentalManagement.maintenanceStatus, déclenchée par createTicket/
// resolveTicket. Mocké ici ; testé isolément dans
// rentalMaintenanceSyncService.test.js.
jest.mock('../models/RentalManagement', () => ({ findOne: jest.fn().mockResolvedValue(null) }));
jest.mock('../services/notificationService', () => ({
  notify: jest.fn().mockResolvedValue(), notifyStaff: jest.fn().mockResolvedValue(),
}));
jest.mock('../config/db', () => jest.fn());
jest.mock('node-cron', () => ({ schedule: jest.fn() }));

const RentalMaintenanceTicket = require('../models/RentalMaintenanceTicket');
const { notify, notifyStaff } = require('../services/notificationService');
const {
  createTicket, assignTicket, scheduleTicket, startWork, resolveTicket, closeTicket,
} = require('../services/rentalMaintenanceService');

RentalMaintenanceTicket.RENTAL_MAINTENANCE_STATUS_TRANSITIONS = {
  ouvert: ['assigne', 'planifie', 'en_cours', 'resolu'],
  assigne: ['planifie', 'en_cours', 'resolu'],
  planifie: ['en_cours', 'resolu'],
  en_cours: ['resolu'],
  resolu: ['cloture'],
  cloture: [],
};

const PROPERTY_ID = '707f1f77bcf86cd799439055';
const USER_ID = '507f1f77bcf86cd799439012';

const openTicket = (overrides = {}) => ({
  _id: 'TICKET-1', property: PROPERTY_ID, category: 'plomberie', priority: 'normale', status: 'ouvert',
  description: 'Fuite', assignedTo: null, scheduledFor: null, estimatedCost: null, actualCost: null, resolvedAt: null,
  save: jest.fn().mockResolvedValue(),
  ...overrides,
});

describe('rentalMaintenanceService.createTicket — TEST DATA', () => {
  beforeEach(() => jest.clearAllMocks());

  test('crée un ticket "ouvert" et notifie le staff', async () => {
    RentalMaintenanceTicket.create = jest.fn().mockResolvedValue(openTicket());
    const ticket = await createTicket({
      propertyId: PROPERTY_ID, category: 'plomberie', description: 'Fuite au lavabo', actingUser: { id: USER_ID },
    });
    expect(ticket.status).toBe('ouvert');
    expect(notifyStaff).toHaveBeenCalledWith(expect.objectContaining({ type: 'rental_maintenance_ticket_created' }));
  });
});

describe('rentalMaintenanceService — assign/schedule/start/resolve/close — TEST DATA', () => {
  beforeEach(() => jest.clearAllMocks());

  test('assignTicket : ouvert → assigne, notifie individuellement', async () => {
    const ticket = openTicket();
    RentalMaintenanceTicket.findById = jest.fn().mockResolvedValue(ticket);
    const updated = await assignTicket({ ticketId: ticket._id, assignedToUserId: 'TECH-1', actingUser: { id: USER_ID } });
    expect(updated.status).toBe('assigne');
    expect(updated.assignedTo).toBe('TECH-1');
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ recipient: 'TECH-1', type: 'rental_maintenance_ticket_assigned' }));
  });

  test('assignTicket refuse un ticket déjà resolu', async () => {
    const ticket = openTicket({ status: 'resolu' });
    RentalMaintenanceTicket.findById = jest.fn().mockResolvedValue(ticket);
    await expect(assignTicket({ ticketId: ticket._id, assignedToUserId: 'TECH-1', actingUser: { id: USER_ID } }))
      .rejects.toMatchObject({ statusCode: 409 });
  });

  test('scheduleTicket : renseigne scheduledFor et passe à "planifie"', async () => {
    const ticket = openTicket();
    RentalMaintenanceTicket.findById = jest.fn().mockResolvedValue(ticket);
    const future = new Date(Date.now() + 86400000).toISOString();
    const updated = await scheduleTicket({ ticketId: ticket._id, scheduledFor: future, actingUser: { id: USER_ID } });
    expect(updated.status).toBe('planifie');
    expect(updated.scheduledFor).toBeInstanceOf(Date);
  });

  test('scheduleTicket refuse une date invalide', async () => {
    const ticket = openTicket();
    RentalMaintenanceTicket.findById = jest.fn().mockResolvedValue(ticket);
    await expect(scheduleTicket({ ticketId: ticket._id, scheduledFor: 'pas-une-date', actingUser: { id: USER_ID } }))
      .rejects.toMatchObject({ statusCode: 422 });
  });

  test('startWork : ouvert → en_cours', async () => {
    const ticket = openTicket();
    RentalMaintenanceTicket.findById = jest.fn().mockResolvedValue(ticket);
    const updated = await startWork({ ticketId: ticket._id, actingUser: { id: USER_ID } });
    expect(updated.status).toBe('en_cours');
  });

  test('resolveTicket : en_cours → resolu, coût réel enregistré, notifie le staff', async () => {
    const ticket = openTicket({ status: 'en_cours' });
    RentalMaintenanceTicket.findById = jest.fn().mockResolvedValue(ticket);
    const updated = await resolveTicket({ ticketId: ticket._id, actualCost: 15000, actingUser: { id: USER_ID } });
    expect(updated.status).toBe('resolu');
    expect(updated.actualCost).toBe(15000);
    expect(updated.resolvedAt).toBeInstanceOf(Date);
    expect(notifyStaff).toHaveBeenCalledWith(expect.objectContaining({ type: 'rental_maintenance_ticket_resolved' }));
  });

  test('closeTicket : resolu → cloture', async () => {
    const ticket = openTicket({ status: 'resolu', resolvedAt: new Date() });
    RentalMaintenanceTicket.findById = jest.fn().mockResolvedValue(ticket);
    const updated = await closeTicket({ ticketId: ticket._id, actingUser: { id: USER_ID } });
    expect(updated.status).toBe('cloture');
  });

  test('closeTicket refuse un ticket encore ouvert', async () => {
    const ticket = openTicket({ status: 'ouvert' });
    RentalMaintenanceTicket.findById = jest.fn().mockResolvedValue(ticket);
    await expect(closeTicket({ ticketId: ticket._id, actingUser: { id: USER_ID } })).rejects.toMatchObject({ statusCode: 409 });
  });

  test('404 sur un ticket introuvable (assign/schedule/start/resolve/close)', async () => {
    RentalMaintenanceTicket.findById = jest.fn().mockResolvedValue(null);
    await expect(assignTicket({ ticketId: 'X', assignedToUserId: 'T', actingUser: { id: USER_ID } })).rejects.toMatchObject({ statusCode: 404 });
    await expect(scheduleTicket({ ticketId: 'X', scheduledFor: new Date().toISOString(), actingUser: { id: USER_ID } })).rejects.toMatchObject({ statusCode: 404 });
    await expect(startWork({ ticketId: 'X', actingUser: { id: USER_ID } })).rejects.toMatchObject({ statusCode: 404 });
    await expect(resolveTicket({ ticketId: 'X', actingUser: { id: USER_ID } })).rejects.toMatchObject({ statusCode: 404 });
    await expect(closeTicket({ ticketId: 'X', actingUser: { id: USER_ID } })).rejects.toMatchObject({ statusCode: 404 });
  });
});
