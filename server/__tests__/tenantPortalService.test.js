// __tests__/tenantPortalService.test.js — Dette technique GL-B2 (Mission 2)
// Vérifie que le dossier est TOUJOURS résolu depuis userId — jamais un
// locataireId — et que les projections excluent les champs internes.

jest.mock('../models/Contrat');
jest.mock('../models/Paiement');
jest.mock('../models/RentalManagement');
jest.mock('../models/RentalMaintenanceTicket');
jest.mock('../services/tenantLinkService', () => ({ resolveLocataireForUser: jest.fn() }));
jest.mock('../services/rentalMaintenanceService', () => ({ createTicket: jest.fn() }));
jest.mock('../config/db', () => jest.fn());
jest.mock('node-cron', () => ({ schedule: jest.fn() }));

const Contrat = require('../models/Contrat');
const Paiement = require('../models/Paiement');
const RentalManagement = require('../models/RentalManagement');
const RentalMaintenanceTicket = require('../models/RentalMaintenanceTicket');
const { resolveLocataireForUser } = require('../services/tenantLinkService');
const rentalMaintenanceService = require('../services/rentalMaintenanceService');
const {
  getMyProfile, getMyLease, getMyPayments, getMyPaymentPage, getMyDocuments, getMyNotice, createMyMaintenanceRequest,
} = require('../services/tenantPortalService');

RentalMaintenanceTicket.RENTAL_MAINTENANCE_CATEGORIES = ['plomberie', 'electricite', 'structure', 'equipement', 'nuisible', 'serrurerie', 'peinture', 'autre'];

const LOCATAIRE_ID = 'a07f1f77bcf86cd799439088';
const USER_ID = '507f1f77bcf86cd799439012';
const LEASE_ID = 'b07f1f77bcf86cd799439077';
const PROPERTY_ID = '707f1f77bcf86cd799439055';

const locataire = (overrides = {}) => ({
  _id: LOCATAIRE_ID, nom: 'Dupont', prenom: 'Jean', email: 'jean@test.com', telephone: '0600',
  adresse: 'rue X', ville: 'Kinshasa', profession: 'Ingénieur', revenuMensuel: 500000,
  pieceIdentite: 'url', notes: 'INTERNE — ne jamais exposer au locataire', user: USER_ID,
  ...overrides,
});

const lease = (overrides = {}) => ({
  _id: LEASE_ID, statut: 'actif', bien: { _id: PROPERTY_ID, title: 'Villa', owner: 'OWNER-1' },
  dateEntree: '2026-01-01', dateFinBail: '2026-12-31', montantLoyer: 150000, documents: [],
  ...overrides,
});

describe('tenantPortalService — résolution stricte via userId — TEST DATA', () => {
  beforeEach(() => jest.clearAllMocks());

  test('getMyProfile lève 404 si aucun dossier n\'est rattaché', async () => {
    resolveLocataireForUser.mockResolvedValue(null);
    await expect(getMyProfile(USER_ID)).rejects.toMatchObject({ statusCode: 404 });
  });

  test('getMyProfile n\'expose jamais `notes` (commentaires internes staff)', async () => {
    resolveLocataireForUser.mockResolvedValue(locataire());
    const profile = await getMyProfile(USER_ID);
    expect(profile.notes).toBeUndefined();
    expect(profile.nom).toBe('Dupont');
  });

  test('getMyLease renvoie null sans bail, jamais une erreur', async () => {
    resolveLocataireForUser.mockResolvedValue(locataire());
    Contrat.find = jest.fn().mockReturnValue({ sort: jest.fn().mockReturnThis(), populate: jest.fn().mockResolvedValue([]) });
    expect(await getMyLease(USER_ID)).toBeNull();
  });

  test('getMyLease renvoie le bail actif préféré', async () => {
    resolveLocataireForUser.mockResolvedValue(locataire());
    Contrat.find = jest.fn().mockReturnValue({ sort: jest.fn().mockReturnThis(), populate: jest.fn().mockResolvedValue([lease()]) });
    const result = await getMyLease(USER_ID);
    expect(result.montantLoyer).toBe(150000);
  });

  test('getMyLease expose GL-LIFE-1 sans exposer les URLs documentaires', async () => {
    resolveLocataireForUser.mockResolvedValue(locataire());
    Contrat.find = jest.fn().mockReturnValue({ sort: jest.fn().mockReturnThis(), populate: jest.fn().mockResolvedValue([lease({
      cycleVie: 'inspection_sortie', cycleHistory: [{ action: 'inspection', to: 'inspection_sortie' }],
      avenants: [{ type: 'renouvellement' }], caution: { statut: 'bloquee' },
      proprietaire: { _id: 'OWNER', nom: 'Makosso', prenom: 'Aline', email: 'a@test.cg' },
      etatsDesLieux: [{ type: 'sortie', documentUrl: 'https://secret.example/doc.pdf', validatedByStaff: true }],
    })]) });
    const result = await getMyLease(USER_ID);
    expect(result).toEqual(expect.objectContaining({ cycleVie: 'inspection_sortie', caution: { statut: 'bloquee' } }));
    expect(result.proprietaire.nom).toBe('Makosso');
    expect(result.etatsDesLieux[0].documentUrl).toBeUndefined();
  });

  test('getMyPayments interroge Paiement filtré par le bail du locataire résolu', async () => {
    resolveLocataireForUser.mockResolvedValue(locataire());
    Contrat.find = jest.fn().mockReturnValue({ sort: jest.fn().mockReturnThis(), populate: jest.fn().mockResolvedValue([lease()]) });
    Paiement.find = jest.fn().mockReturnValue({ select: jest.fn().mockReturnThis(), sort: jest.fn().mockResolvedValue([]) });
    await getMyPayments(USER_ID);
    expect(Paiement.find).toHaveBeenCalledWith({ contrat: LEASE_ID });
  });

  test('summary reste global avec 12 échéances quand la page demandée est limitée à 5', async () => {
    resolveLocataireForUser.mockResolvedValue(locataire());
    Contrat.find = jest.fn().mockReturnValue({ sort: jest.fn().mockReturnThis(), populate: jest.fn().mockResolvedValue([lease()]) });
    const pageRows = Array.from({ length: 5 }, (_, index) => ({
      _id: `PAY-${index}`, contrat: LEASE_ID, mois: index + 1, annee: 2026,
      montant: 100, montantTotal: 110, montantRecu: 60, penaliteMontant: 10, statut: 'partiel',
    }));
    Paiement.find = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(), sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(pageRows),
    });
    Paiement.countDocuments = jest.fn().mockResolvedValue(12);
    Paiement.aggregate = jest.fn().mockResolvedValue([{ du: 1320, recu: 720, penalites: 120, restant: 600 }]);

    const page = await getMyPaymentPage(USER_ID, { page: 1, limit: 5 });

    expect(page.payments).toHaveLength(5);
    expect(page.pagination.total).toBe(12);
    expect(page.summary).toEqual({ du: 1320, recu: 720, penalites: 120, restant: 600 });
  });

  test('getMyDocuments renvoie les documents du bail (jamais ceux d\'un autre locataire)', async () => {
    resolveLocataireForUser.mockResolvedValue(locataire());
    Contrat.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      populate: jest.fn().mockResolvedValue([lease({ documents: [{ nom: 'Bail', url: 'u', type: 'bail', dateGeneration: new Date() }] })]),
    });
    const docs = await getMyDocuments(USER_ID);
    expect(docs).toHaveLength(1);
    expect(docs[0].nom).toBe('Bail');
  });

  test('getMyNotice renvoie null si aucun préavis actif', async () => {
    resolveLocataireForUser.mockResolvedValue(locataire());
    Contrat.find = jest.fn().mockReturnValue({ sort: jest.fn().mockReturnThis(), populate: jest.fn().mockResolvedValue([lease()]) });
    RentalManagement.findOne = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue({ occupancyStatus: 'occupe' }) });
    expect(await getMyNotice(USER_ID)).toBeNull();
  });

  test('getMyNotice renvoie le préavis si sortie_programmee', async () => {
    resolveLocataireForUser.mockResolvedValue(locataire());
    Contrat.find = jest.fn().mockReturnValue({ sort: jest.fn().mockReturnThis(), populate: jest.fn().mockResolvedValue([lease()]) });
    RentalManagement.findOne = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue({ occupancyStatus: 'sortie_programmee', plannedExitAt: '2026-09-01' }) });
    const notice = await getMyNotice(USER_ID);
    expect(notice.plannedExitAt).toBe('2026-09-01');
  });

  test('createMyMaintenanceRequest résout propertyId/leaseId/tenantId côté serveur (jamais depuis le body)', async () => {
    resolveLocataireForUser.mockResolvedValue(locataire());
    Contrat.find = jest.fn().mockReturnValue({ sort: jest.fn().mockReturnThis(), populate: jest.fn().mockResolvedValue([lease()]) });
    rentalMaintenanceService.createTicket.mockResolvedValue({ _id: 'TICKET-1' });
    await createMyMaintenanceRequest(USER_ID, { category: 'plomberie', description: 'Fuite' });
    expect(rentalMaintenanceService.createTicket).toHaveBeenCalledWith(expect.objectContaining({
      propertyId: PROPERTY_ID, leaseId: LEASE_ID, tenantId: LOCATAIRE_ID, ownerId: 'OWNER-1',
    }));
  });

  test('createMyMaintenanceRequest refuse sans bail actif', async () => {
    resolveLocataireForUser.mockResolvedValue(locataire());
    Contrat.find = jest.fn().mockReturnValue({ sort: jest.fn().mockReturnThis(), populate: jest.fn().mockResolvedValue([]) });
    await expect(createMyMaintenanceRequest(USER_ID, { category: 'plomberie', description: 'x' })).rejects.toMatchObject({ statusCode: 409 });
  });

  test('createMyMaintenanceRequest refuse une catégorie invalide', async () => {
    resolveLocataireForUser.mockResolvedValue(locataire());
    Contrat.find = jest.fn().mockReturnValue({ sort: jest.fn().mockReturnThis(), populate: jest.fn().mockResolvedValue([lease()]) });
    await expect(createMyMaintenanceRequest(USER_ID, { category: 'inconnu', description: 'x' })).rejects.toMatchObject({ statusCode: 422 });
  });
});
