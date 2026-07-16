jest.mock('../models/Property', () => ({ findById: jest.fn() }));
jest.mock('../models/RentalManagement', () => ({ findById: jest.fn() }));
jest.mock('../services/notificationService', () => ({ notify: jest.fn().mockResolvedValue({}), notifyStaff: jest.fn().mockResolvedValue(undefined) }));

const mongoose = require('mongoose');
const Property = require('../models/Property');
const RentalManagement = require('../models/RentalManagement');
const sync = require('../services/rentalListingSyncService');
const notifications = require('../services/notificationService');

const managementId = new mongoose.Types.ObjectId();
const propertyId = new mongoose.Types.ObjectId();
const ownerId = new mongoose.Types.ObjectId();

const makeProperty = (overrides = {}) => ({
  _id: propertyId,
  title: 'TEST DATA PROPERTY', type: 'Appartement', description: 'TEST DATA DESCRIPTION',
  status: 'location', price: 250000, surface: 80, images: ['https://example.test/image.jpg'],
  address: { city: 'Brazzaville', arrondissement: 'TEST DATA ARRONDISSEMENT', neighborhood: 'TEST DATA QUARTIER' },
  owner: ownerId, statusAdmin: 'Validée', availability: 'Disponible', isPublished: false,
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const makeManagement = (overrides = {}) => ({
  _id: managementId, property: propertyId, owner: ownerId, active: true,
  occupancyStatus: 'vacant', availabilityStatus: 'disponible', publicationStatus: 'brouillon',
  publicationPolicy: 'manuelle', publicationAuthorized: true, monthlyRent: 250000,
  maintenanceStatus: 'aucune', workflowHistory: [], publicationReadiness: {},
  save: jest.fn().mockResolvedValue(undefined),
  toObject() { return { ...this, save: undefined, toObject: undefined }; },
  ...overrides,
});

const context = (management = makeManagement(), property = makeProperty()) => {
  RentalManagement.findById.mockResolvedValue(management);
  Property.findById.mockResolvedValue(property);
  return { management, property };
};

describe('rentalListingSyncService', () => {
  beforeEach(() => jest.clearAllMocks());

  test('readiness détaille les champs manquants sans exposer de données privées', () => {
    const result = sync.evaluatePublicationReadiness(makeProperty({ images: [], address: { city: 'Brazzaville' } }));
    expect(result.ready).toBe(false);
    expect(result.missingFields).toEqual(expect.arrayContaining(['images', 'arrondissement', 'neighborhood']));
    expect(result).not.toHaveProperty('tenant');
  });

  test('bien disponible validé → publie le même Property sans créer un doublon', async () => {
    const { management, property } = context();
    await sync.publishRentalProperty(managementId, ownerId);
    expect(property.isPublished).toBe(true);
    expect(property.availability).toBe('Disponible');
    expect(management.publicationStatus).toBe('publie');
    expect(Property.create).toBeUndefined();

    await sync.publishRentalProperty(managementId, ownerId);
    expect(management.workflowHistory.filter((item) => item.action === 'publish')).toHaveLength(1);
    expect(Property.findById).toHaveBeenCalledTimes(2);
  });

  test('modération non validée → place en attente sans publication forcée', async () => {
    const { management, property } = context(makeManagement({ publicationStatus: 'suspendu' }), makeProperty({ statusAdmin: 'Rejetée' }));
    await sync.publishRentalProperty(managementId, ownerId);
    expect(property.isPublished).toBe(false);
    expect(property.statusAdmin).toBe('En attente');
    expect(management.publicationStatus).toBe('en_attente_moderation');
  });

  test('contrat actif → occupé, loué et annonce suspendue', async () => {
    const { management, property } = context(makeManagement({ publicationStatus: 'publie' }), makeProperty({ isPublished: true }));
    await sync.markPropertyRented(managementId, { leaseId: new mongoose.Types.ObjectId(), tenantId: new mongoose.Types.ObjectId(), actor: ownerId });
    expect(management.occupancyStatus).toBe('occupe');
    expect(management.availabilityStatus).toBe('loue');
    expect(management.publicationStatus).toBe('suspendu');
    expect(property.availability).toBe('Loué');
    expect(property.isPublished).toBe(false);
  });

  test('fin de contrat → sortie programmée, jamais republication immédiate', async () => {
    const { management, property } = context(makeManagement({ occupancyStatus: 'occupe', activeLease: new mongoose.Types.ObjectId() }), makeProperty({ availability: 'Loué' }));
    await sync.schedulePropertyExit(managementId, { actor: ownerId });
    expect(management.occupancyStatus).toBe('sortie_programmee');
    expect(property.availability).toBe('Indisponible');
    expect(property.isPublished).toBe(false);
  });

  test('sortie non validée → remise en vacance refusée', async () => {
    context(makeManagement({ occupancyStatus: 'sortie_programmee', exitInspectionClearedAt: null }));
    await expect(sync.markPropertyVacant(managementId, { actor: ownerId })).rejects.toMatchObject({ statusCode: 422 });
  });

  test('état de sortie validé et sans maintenance → vacant', async () => {
    const { management, property } = context(makeManagement({ occupancyStatus: 'sortie_programmee', activeLease: null, exitInspectionClearedAt: new Date() }), makeProperty({ availability: 'Indisponible' }));
    await sync.markPropertyVacant(managementId, { actor: ownerId });
    expect(management.occupancyStatus).toBe('vacant');
    expect(management.availabilityStatus).toBe('disponible');
    expect(property.availability).toBe('Disponible');
  });

  test('maintenance → indisponible et annonce suspendue', async () => {
    const { management, property } = context(makeManagement({ publicationStatus: 'publie' }), makeProperty({ isPublished: true }));
    await sync.markMaintenance(managementId, { actor: ownerId });
    expect(management.availabilityStatus).toBe('maintenance');
    expect(management.publicationStatus).toBe('suspendu');
    expect(property.availability).toBe('En maintenance');
    expect(property.isPublished).toBe(false);
  });

  test('fin maintenance exige un contrôle puis recalcule readiness', async () => {
    context(makeManagement({ occupancyStatus: 'travaux', availabilityStatus: 'maintenance', maintenanceStatus: 'en_cours' }), makeProperty({ availability: 'En maintenance' }));
    await expect(sync.completeMaintenance(managementId, { actor: ownerId })).rejects.toMatchObject({ statusCode: 422 });
    const result = await sync.completeMaintenance(managementId, { actor: ownerId, controlValidated: true });
    expect(result.management.occupancyStatus).toBe('vacant');
    expect(result.readiness.ready).toBe(true);
  });

  test('deux publications idempotentes ne produisent qu’une transition notifiée', async () => {
    context();
    await sync.publishRentalProperty(managementId, ownerId);
    await sync.publishRentalProperty(managementId, ownerId);
    expect(notifications.notifyStaff).toHaveBeenCalledTimes(1);
  });
});
