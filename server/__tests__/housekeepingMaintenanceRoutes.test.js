// __tests__/housekeepingMaintenanceRoutes.test.js — Sprint E
// Sécurité et routage HTTP des endpoints Housekeeping/Inspection/
// Maintenance. Modèles + services mockés (même convention que
// hotelOperationsRoutes.test.js, Sprint D).

jest.mock('../models/Hotel');
jest.mock('../models/HotelStaffAssignment');
jest.mock('../models/Room');
jest.mock('../models/HousekeepingTask');
jest.mock('../models/RoomInspection');
jest.mock('../models/MaintenanceTicket');
jest.mock('../models/User');
jest.mock('../services/housekeepingService');
jest.mock('../services/inspectionService');
jest.mock('../services/maintenanceService');
jest.mock('../config/db', () => jest.fn());
jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('../scripts/sync-facebook', () => ({ syncFacebook: jest.fn() }));
jest.mock('../services/zohoImapService', () => ({ pollZohoInbox: jest.fn() }));
jest.mock('../services/alerteService', () => ({ verifierPaiementsEnRetard: jest.fn() }));
jest.mock('../utils/generateSitemap', () => jest.fn().mockResolvedValue('<xml/>'));
jest.mock('../services/notificationService', () => ({
  notify: jest.fn().mockResolvedValue(), notifyStaff: jest.fn().mockResolvedValue(), notifyMany: jest.fn().mockResolvedValue(),
}));
jest.mock('../config/cloudinary', () => ({
  ...jest.requireActual('../config/cloudinary'),
  destroyFromCloudinary: jest.fn().mockResolvedValue(),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app } = require('../server');
const Hotel = require('../models/Hotel');
const HotelStaffAssignment = require('../models/HotelStaffAssignment');
const Room = require('../models/Room');
const HousekeepingTask = require('../models/HousekeepingTask');
const RoomInspection = require('../models/RoomInspection');
const MaintenanceTicket = require('../models/MaintenanceTicket');
const User = require('../models/User');
const housekeepingService = require('../services/housekeepingService');
const inspectionService = require('../services/inspectionService');
const maintenanceService = require('../services/maintenanceService');

HousekeepingTask.HOUSEKEEPING_TYPES = ['checkout_cleaning', 'refresh', 'deep_cleaning'];
MaintenanceTicket.MAINTENANCE_CATEGORIES = ['plumbing', 'electricity', 'furniture', 'cleanliness', 'security', 'other'];

const OWNER_ID = '507f1f77bcf86cd799439011';
const OTHER_OWNER_ID = '507f1f77bcf86cd799439099';
const ADMIN_ID = '507f1f77bcf86cd799439012';
const CLIENT_ID = '507f1f77bcf86cd799439033';
const HOTEL_ID = '707f1f77bcf86cd799439055';
const ROOM_ID = 'a07f1f77bcf86cd799439088';
const TASK_ID = 'b07f1f77bcf86cd799439077';
const INSPECTION_ID = 'c07f1f77bcf86cd799439066';
const TICKET_ID = 'd07f1f77bcf86cd799439055';

const makeToken = (id) => jwt.sign({ id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' });
const fakeUser = (id, role) => ({ _id: id, id, name: 'Test User', email: 't@a.com', role, isActive: true, status: 'Actif', tokenVersion: 0 });
const mockUserAuth = (id, role) => {
  User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser(id, role)) });
  User.findByIdAndUpdate = jest.fn().mockReturnValue({ catch: jest.fn() });
};

describe('POST /api/housekeeping — création (Sprint E)', () => {
  afterEach(() => jest.clearAllMocks());

  test('403 — un propriétaire tiers ne peut pas créer de tâche sur un hôtel qui n\'est pas le sien', async () => {
    mockUserAuth(OTHER_OWNER_ID, 'Proprietaire');
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    const res = await request(app).post('/api/housekeeping').set('Authorization', `Bearer ${makeToken(OTHER_OWNER_ID)}`)
      .send({ roomId: ROOM_ID, hotelId: HOTEL_ID, type: 'refresh' });
    expect(res.statusCode).toBe(403);
  });

  test('403 — un client ne peut jamais créer de tâche de ménage (mission §14)', async () => {
    mockUserAuth(CLIENT_ID, 'Client');
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    const res = await request(app).post('/api/housekeeping').set('Authorization', `Bearer ${makeToken(CLIENT_ID)}`)
      .send({ roomId: ROOM_ID, hotelId: HOTEL_ID, type: 'refresh' });
    expect(res.statusCode).toBe(403);
    expect(housekeepingService.createTask).not.toHaveBeenCalled();
  });

  test('201 — le propriétaire crée une tâche pour son hôtel', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    Room.findOne = jest.fn().mockResolvedValue({ _id: ROOM_ID, hotel: HOTEL_ID, roomNumber: '101' });
    housekeepingService.createTask.mockResolvedValue({ _id: TASK_ID, type: 'refresh', status: 'pending' });
    const res = await request(app).post('/api/housekeeping').set('Authorization', `Bearer ${makeToken(OWNER_ID)}`)
      .send({ roomId: ROOM_ID, hotelId: HOTEL_ID, type: 'refresh' });
    expect(res.statusCode).toBe(201);
  });

  test('422 — type de tâche invalide', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    const res = await request(app).post('/api/housekeeping').set('Authorization', `Bearer ${makeToken(OWNER_ID)}`)
      .send({ roomId: ROOM_ID, hotelId: HOTEL_ID, type: 'bricolage' });
    expect(res.statusCode).toBe(422);
  });

  test('409 — une tâche ouverte existe déjà pour cette chambre (E11000 converti par le service)', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    Room.findOne = jest.fn().mockResolvedValue({ _id: ROOM_ID, hotel: HOTEL_ID, roomNumber: '101' });
    const err = new Error('Une tâche de ménage est déjà ouverte pour cette chambre.'); err.statusCode = 409;
    housekeepingService.createTask.mockRejectedValue(err);
    const res = await request(app).post('/api/housekeeping').set('Authorization', `Bearer ${makeToken(OWNER_ID)}`)
      .send({ roomId: ROOM_ID, hotelId: HOTEL_ID, type: 'refresh' });
    expect(res.statusCode).toBe(409);
  });

  test('401 sans jeton', async () => {
    const res = await request(app).post('/api/housekeeping').send({ roomId: ROOM_ID, hotelId: HOTEL_ID, type: 'refresh' });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/housekeeping — liste filtrable (Sprint E)', () => {
  afterEach(() => jest.clearAllMocks());

  test("200 — le propriétaire ne voit que ses propres hôtels (scope automatique sans hotelId)", async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    HotelStaffAssignment.find = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
    Hotel.find = jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([{ _id: HOTEL_ID }]), sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([{ _id: HOTEL_ID }]) }) }) });
    HousekeepingTask.find = jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnThis(), sort: jest.fn().mockResolvedValue([]),
    });
    const res = await request(app).get('/api/housekeeping').set('Authorization', `Bearer ${makeToken(OWNER_ID)}`);
    expect(res.statusCode).toBe(200);
    expect(HousekeepingTask.find).toHaveBeenCalledWith(expect.objectContaining({ hotel: { $in: [HOTEL_ID] } }));
  });

  test('200 — filtre par statut et priorité transmis à la requête', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    Hotel.find = jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) }) });
    HousekeepingTask.find = jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnThis(), sort: jest.fn().mockResolvedValue([]),
    });
    await request(app).get('/api/housekeeping?status=pending&priority=urgent').set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`);
    expect(HousekeepingTask.find).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending', priority: 'urgent' }));
  });
});

describe('PATCH /api/housekeeping/:id/assign|start|complete|cancel (Sprint E)', () => {
  afterEach(() => jest.clearAllMocks());

  test('200 — le staff assigne une tâche', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    HousekeepingTask.findById = jest.fn().mockResolvedValue({ _id: TASK_ID, hotel: HOTEL_ID });
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    housekeepingService.assignTask.mockResolvedValue({ _id: TASK_ID, status: 'assigned', assignedTo: 'EMP-1' });
    const res = await request(app).patch(`/api/housekeeping/${TASK_ID}/assign`).set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send({ assignedToUserId: 'a07f1f77bcf86cd799439001' });
    expect(res.statusCode).toBe(200);
  });

  test('403 — un propriétaire tiers ne peut pas démarrer une tâche sur un hôtel qui n\'est pas le sien', async () => {
    mockUserAuth(OTHER_OWNER_ID, 'Proprietaire');
    HousekeepingTask.findById = jest.fn().mockResolvedValue({ _id: TASK_ID, hotel: HOTEL_ID });
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    const res = await request(app).patch(`/api/housekeeping/${TASK_ID}/start`).set('Authorization', `Bearer ${makeToken(OTHER_OWNER_ID)}`);
    expect(res.statusCode).toBe(403);
  });

  test('200 — le propriétaire termine une tâche (chambre → inspection géré par le service)', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    HousekeepingTask.findById = jest.fn().mockResolvedValue({ _id: TASK_ID, hotel: HOTEL_ID });
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    housekeepingService.completeTask.mockResolvedValue({ _id: TASK_ID, status: 'completed', room: ROOM_ID });
    const res = await request(app).patch(`/api/housekeeping/${TASK_ID}/complete`).set('Authorization', `Bearer ${makeToken(OWNER_ID)}`);
    expect(res.statusCode).toBe(200);
  });

  test('409 — transition invalide remontée par le service', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    HousekeepingTask.findById = jest.fn().mockResolvedValue({ _id: TASK_ID, hotel: HOTEL_ID });
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    const err = new Error('Transition invalide : pending → completed.'); err.statusCode = 409;
    housekeepingService.completeTask.mockRejectedValue(err);
    const res = await request(app).patch(`/api/housekeeping/${TASK_ID}/complete`).set('Authorization', `Bearer ${makeToken(OWNER_ID)}`);
    expect(res.statusCode).toBe(409);
  });

  test('200 — annulation par le staff', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    HousekeepingTask.findById = jest.fn().mockResolvedValue({ _id: TASK_ID, hotel: HOTEL_ID });
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    housekeepingService.cancelTask.mockResolvedValue({ _id: TASK_ID, status: 'cancelled' });
    const res = await request(app).patch(`/api/housekeeping/${TASK_ID}/cancel`).set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`).send({ reason: 'x' });
    expect(res.statusCode).toBe(200);
  });

  test('401 sans jeton', async () => {
    const res = await request(app).patch(`/api/housekeeping/${TASK_ID}/start`);
    expect(res.statusCode).toBe(401);
  });
});

describe('POST /api/inspections + PATCH approve/reject (Sprint E)', () => {
  afterEach(() => jest.clearAllMocks());

  test('201 — le propriétaire crée une inspection pour sa chambre', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    Room.findById = jest.fn().mockResolvedValue({ _id: ROOM_ID, hotel: HOTEL_ID, roomNumber: '101' });
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    inspectionService.createInspection.mockResolvedValue({ _id: INSPECTION_ID, room: ROOM_ID, result: null });
    const res = await request(app).post('/api/inspections').set('Authorization', `Bearer ${makeToken(OWNER_ID)}`)
      .send({ roomId: ROOM_ID, housekeepingTaskId: TASK_ID });
    expect(res.statusCode).toBe(201);
  });

  test('403 — un propriétaire tiers ne peut pas créer d\'inspection sur une chambre qui n\'est pas la sienne', async () => {
    mockUserAuth(OTHER_OWNER_ID, 'Proprietaire');
    Room.findById = jest.fn().mockResolvedValue({ _id: ROOM_ID, hotel: HOTEL_ID, roomNumber: '101' });
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    const res = await request(app).post('/api/inspections').set('Authorization', `Bearer ${makeToken(OTHER_OWNER_ID)}`)
      .send({ roomId: ROOM_ID, housekeepingTaskId: TASK_ID });
    expect(res.statusCode).toBe(403);
  });

  test('403 — un client ne peut jamais créer d\'inspection (mission §14)', async () => {
    mockUserAuth(CLIENT_ID, 'Client');
    Room.findById = jest.fn().mockResolvedValue({ _id: ROOM_ID, hotel: HOTEL_ID, roomNumber: '101' });
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    const res = await request(app).post('/api/inspections').set('Authorization', `Bearer ${makeToken(CLIENT_ID)}`)
      .send({ roomId: ROOM_ID, housekeepingTaskId: TASK_ID });
    expect(res.statusCode).toBe(403);
    expect(inspectionService.createInspection).not.toHaveBeenCalled();
  });

  test('200 — approbation : la chambre revient disponible', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    RoomInspection.findById = jest.fn().mockResolvedValue({ _id: INSPECTION_ID, room: ROOM_ID });
    Room.findById = jest.fn().mockResolvedValue({ _id: ROOM_ID, hotel: HOTEL_ID });
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    inspectionService.approveInspection.mockResolvedValue({ inspection: { _id: INSPECTION_ID, result: 'passed' }, room: { _id: ROOM_ID, roomNumber: '101', status: 'available' } });
    const res = await request(app).patch(`/api/inspections/${INSPECTION_ID}/approve`).set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.room.status).toBe('available');
  });

  test('409 — approbation refusée : ticket de maintenance encore ouvert (remonté par le service)', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    RoomInspection.findById = jest.fn().mockResolvedValue({ _id: INSPECTION_ID, room: ROOM_ID });
    Room.findById = jest.fn().mockResolvedValue({ _id: ROOM_ID, hotel: HOTEL_ID });
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    const err = new Error('Un ticket de maintenance est encore ouvert pour cette chambre.'); err.statusCode = 409;
    inspectionService.approveInspection.mockRejectedValue(err);
    const res = await request(app).patch(`/api/inspections/${INSPECTION_ID}/approve`).set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`);
    expect(res.statusCode).toBe(409);
  });

  test('200 — rejet : la chambre passe hors service', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    RoomInspection.findById = jest.fn().mockResolvedValue({ _id: INSPECTION_ID, room: ROOM_ID });
    Room.findById = jest.fn().mockResolvedValue({ _id: ROOM_ID, hotel: HOTEL_ID });
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    inspectionService.rejectInspection.mockResolvedValue({ inspection: { _id: INSPECTION_ID, result: 'failed' }, room: { _id: ROOM_ID, roomNumber: '101', status: 'out_of_service' } });
    const res = await request(app).patch(`/api/inspections/${INSPECTION_ID}/reject`).set('Authorization', `Bearer ${makeToken(OWNER_ID)}`).send({ notes: 'Robinet cassé' });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.room.status).toBe('out_of_service');
  });

  test('401 sans jeton', async () => {
    const res = await request(app).patch(`/api/inspections/${INSPECTION_ID}/approve`);
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/maintenance — liste filtrable (Sprint E)', () => {
  afterEach(() => jest.clearAllMocks());

  test('200 — liste avec populate room/hotel/assignedTo/inspection.housekeepingTask', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    Hotel.find = jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) }) });
    const populateChain = { populate: jest.fn(), sort: jest.fn().mockResolvedValue([]) };
    populateChain.populate.mockReturnValue(populateChain);
    MaintenanceTicket.find = jest.fn().mockReturnValue(populateChain);
    const res = await request(app).get('/api/maintenance?status=open').set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`);
    expect(res.statusCode).toBe(200);
    expect(MaintenanceTicket.find).toHaveBeenCalledWith(expect.objectContaining({ status: 'open' }));
  });
});

describe('POST /api/maintenance + PATCH assign/start/resolve/close (Sprint E)', () => {
  afterEach(() => jest.clearAllMocks());

  test('201 — le propriétaire crée un ticket pour sa chambre', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    Room.findOne = jest.fn().mockResolvedValue({ _id: ROOM_ID, hotel: HOTEL_ID, roomNumber: '101' });
    maintenanceService.createTicket.mockResolvedValue({ _id: TICKET_ID, status: 'open' });
    const res = await request(app).post('/api/maintenance').set('Authorization', `Bearer ${makeToken(OWNER_ID)}`)
      .send({ roomId: ROOM_ID, hotelId: HOTEL_ID, category: 'plumbing', description: 'Fuite au lavabo' });
    expect(res.statusCode).toBe(201);
  });

  test('422 — catégorie invalide', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    const res = await request(app).post('/api/maintenance').set('Authorization', `Bearer ${makeToken(OWNER_ID)}`)
      .send({ roomId: ROOM_ID, hotelId: HOTEL_ID, category: 'inconnu', description: 'x' });
    expect(res.statusCode).toBe(422);
  });

  test('422 — description manquante', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    const res = await request(app).post('/api/maintenance').set('Authorization', `Bearer ${makeToken(OWNER_ID)}`)
      .send({ roomId: ROOM_ID, hotelId: HOTEL_ID, category: 'plumbing' });
    expect(res.statusCode).toBe(422);
  });

  test('403 — un client ne peut jamais créer de ticket de maintenance (mission §14)', async () => {
    mockUserAuth(CLIENT_ID, 'Client');
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    const res = await request(app).post('/api/maintenance').set('Authorization', `Bearer ${makeToken(CLIENT_ID)}`)
      .send({ roomId: ROOM_ID, hotelId: HOTEL_ID, category: 'plumbing', description: 'Fuite' });
    expect(res.statusCode).toBe(403);
    expect(maintenanceService.createTicket).not.toHaveBeenCalled();
  });

  test('200 — le staff assigne un ticket à un technicien', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    MaintenanceTicket.findById = jest.fn().mockResolvedValue({ _id: TICKET_ID, hotel: HOTEL_ID });
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    maintenanceService.assignTicket.mockResolvedValue({ _id: TICKET_ID, status: 'assigned' });
    const res = await request(app).patch(`/api/maintenance/${TICKET_ID}/assign`).set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send({ assignedToUserId: 'a07f1f77bcf86cd799439001' });
    expect(res.statusCode).toBe(200);
  });

  test('200 — le propriétaire résout un ticket', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    MaintenanceTicket.findById = jest.fn().mockResolvedValue({ _id: TICKET_ID, hotel: HOTEL_ID });
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    maintenanceService.resolveTicket.mockResolvedValue({ _id: TICKET_ID, status: 'resolved' });
    const res = await request(app).patch(`/api/maintenance/${TICKET_ID}/resolve`).set('Authorization', `Bearer ${makeToken(OWNER_ID)}`);
    expect(res.statusCode).toBe(200);
  });

  test('200 — clôture d\'un ticket résolu', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    MaintenanceTicket.findById = jest.fn().mockResolvedValue({ _id: TICKET_ID, hotel: HOTEL_ID });
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    maintenanceService.closeTicket.mockResolvedValue({ _id: TICKET_ID, status: 'closed' });
    const res = await request(app).patch(`/api/maintenance/${TICKET_ID}/close`).set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`);
    expect(res.statusCode).toBe(200);
  });

  test('403 — un propriétaire tiers ne peut pas gérer un ticket sur un hôtel qui n\'est pas le sien', async () => {
    mockUserAuth(OTHER_OWNER_ID, 'Proprietaire');
    MaintenanceTicket.findById = jest.fn().mockResolvedValue({ _id: TICKET_ID, hotel: HOTEL_ID });
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    const res = await request(app).patch(`/api/maintenance/${TICKET_ID}/start`).set('Authorization', `Bearer ${makeToken(OTHER_OWNER_ID)}`);
    expect(res.statusCode).toBe(403);
  });

  test('401 sans jeton', async () => {
    const res = await request(app).get('/api/maintenance');
    expect(res.statusCode).toBe(401);
  });
});
