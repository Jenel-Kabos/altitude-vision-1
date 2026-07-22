// __tests__/rentalMaintenanceSyncService.test.js — Dette technique GL-B2
// (Mission 6). Vérifie que RentalManagement.maintenanceStatus reste
// cohérent avec les tickets RentalMaintenanceTicket ouverts — jamais deux
// sources de vérité contradictoires.

jest.mock('../models/RentalMaintenanceTicket');
jest.mock('../models/RentalManagement');
jest.mock('../services/notificationService', () => ({
  notify: jest.fn().mockResolvedValue(), notifyStaff: jest.fn().mockResolvedValue(),
}));
jest.mock('../config/db', () => jest.fn());
jest.mock('node-cron', () => ({ schedule: jest.fn() }));

const RentalMaintenanceTicket = require('../models/RentalMaintenanceTicket');
const RentalManagement = require('../models/RentalManagement');
const { syncRentalManagementMaintenanceStatus, createTicket, resolveTicket } = require('../services/rentalMaintenanceService');

RentalMaintenanceTicket.OPEN_RENTAL_MAINTENANCE_STATUSES = ['ouvert', 'assigne', 'planifie', 'en_cours'];
RentalMaintenanceTicket.RENTAL_MAINTENANCE_STATUS_TRANSITIONS = {
  ouvert: ['assigne', 'planifie', 'en_cours', 'resolu'],
  assigne: ['planifie', 'en_cours', 'resolu'],
  planifie: ['en_cours', 'resolu'],
  en_cours: ['resolu'],
  resolu: ['cloture'],
  cloture: [],
};

const PROPERTY_ID = '707f1f77bcf86cd799439055';

const rentalManagement = (overrides = {}) => ({
  _id: 'RM1', property: PROPERTY_ID, maintenanceStatus: 'aucune', save: jest.fn().mockResolvedValue(),
  ...overrides,
});

describe('rentalMaintenanceService.syncRentalManagementMaintenanceStatus — TEST DATA', () => {
  beforeEach(() => jest.clearAllMocks());

  test('un ticket ouvert fait passer maintenanceStatus à "en_cours"', async () => {
    const rm = rentalManagement();
    RentalManagement.findOne = jest.fn().mockResolvedValue(rm);
    RentalMaintenanceTicket.countDocuments = jest.fn().mockResolvedValue(1);
    await syncRentalManagementMaintenanceStatus(PROPERTY_ID);
    expect(rm.maintenanceStatus).toBe('en_cours');
    expect(rm.save).toHaveBeenCalled();
  });

  test('aucun ticket ouvert restant fait revenir maintenanceStatus à "aucune"', async () => {
    const rm = rentalManagement({ maintenanceStatus: 'en_cours' });
    RentalManagement.findOne = jest.fn().mockResolvedValue(rm);
    RentalMaintenanceTicket.countDocuments = jest.fn().mockResolvedValue(0);
    await syncRentalManagementMaintenanceStatus(PROPERTY_ID);
    expect(rm.maintenanceStatus).toBe('aucune');
  });

  test('ne touche jamais un statut "controle_requis" (décision manuelle post-inspection)', async () => {
    const rm = rentalManagement({ maintenanceStatus: 'controle_requis' });
    RentalManagement.findOne = jest.fn().mockResolvedValue(rm);
    RentalMaintenanceTicket.countDocuments = jest.fn();
    await syncRentalManagementMaintenanceStatus(PROPERTY_ID);
    expect(rm.maintenanceStatus).toBe('controle_requis');
    expect(rm.save).not.toHaveBeenCalled();
    expect(RentalMaintenanceTicket.countDocuments).not.toHaveBeenCalled();
  });

  test('ne fait rien si le bien n\'a pas de dossier RentalManagement', async () => {
    RentalManagement.findOne = jest.fn().mockResolvedValue(null);
    await expect(syncRentalManagementMaintenanceStatus(PROPERTY_ID)).resolves.toBeUndefined();
  });

  test('idempotent — pas de sauvegarde inutile si le statut est déjà correct', async () => {
    const rm = rentalManagement({ maintenanceStatus: 'en_cours' });
    RentalManagement.findOne = jest.fn().mockResolvedValue(rm);
    RentalMaintenanceTicket.countDocuments = jest.fn().mockResolvedValue(2);
    await syncRentalManagementMaintenanceStatus(PROPERTY_ID);
    expect(rm.save).not.toHaveBeenCalled();
  });

  test('createTicket déclenche la synchronisation', async () => {
    const rm = rentalManagement();
    RentalManagement.findOne = jest.fn().mockResolvedValue(rm);
    RentalMaintenanceTicket.countDocuments = jest.fn().mockResolvedValue(1);
    RentalMaintenanceTicket.create = jest.fn().mockResolvedValue({ _id: 'T1', property: PROPERTY_ID });
    await createTicket({ propertyId: PROPERTY_ID, category: 'plomberie', description: 'Fuite', actingUser: { id: 'U1' } });
    expect(RentalManagement.findOne).toHaveBeenCalledWith({ property: PROPERTY_ID });
    expect(rm.maintenanceStatus).toBe('en_cours');
  });

  test('resolveTicket déclenche la synchronisation (retour à "aucune" si plus aucun ticket ouvert)', async () => {
    const rm = rentalManagement({ maintenanceStatus: 'en_cours' });
    RentalManagement.findOne = jest.fn().mockResolvedValue(rm);
    RentalMaintenanceTicket.countDocuments = jest.fn().mockResolvedValue(0);
    const ticket = { _id: 'T1', property: PROPERTY_ID, status: 'en_cours', save: jest.fn().mockResolvedValue() };
    RentalMaintenanceTicket.findById = jest.fn().mockResolvedValue(ticket);
    await resolveTicket({ ticketId: 'T1', actingUser: { id: 'U1' } });
    expect(rm.maintenanceStatus).toBe('aucune');
  });
});
