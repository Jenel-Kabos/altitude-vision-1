jest.mock('../models/RealEstateApplication');
jest.mock('../models/RealEstateReservation');
jest.mock('../models/Property');
jest.mock('../services/notificationService', () => ({ notify: jest.fn().mockResolvedValue({}) }));
jest.mock('../services/storage/realEstateApplicationStorageService');
jest.mock('../services/realEstateApplicationService');

const Application = require('../models/RealEstateApplication');
const Property = require('../models/Property');
const controller = require('../controllers/realEstateApplicationController');

const response = () => { const res = { statusCode: 200, body: null }; res.status = jest.fn((code) => { res.statusCode = code; return res; }); res.json = jest.fn((body) => { res.body = body; return res; }); res.send = jest.fn(); res.set = jest.fn(() => res); return res; };
const selected = (value) => ({ select: jest.fn().mockResolvedValue(value) });

describe('IM-2 permissions et mass assignment', () => {
  afterEach(() => jest.clearAllMocks());
  test('le propriétaire ne peut candidater sur son propre bien', async () => {
    Property.findById.mockReturnValue(selected({ _id: 'p1', owner: 'u1', status: 'vente', statusAdmin: 'Validée', availability: 'Disponible', isPublished: true }));
    const res = response(); await controller.create({ body: { propertyId: 'p1', amount: 10, validUntil: new Date(Date.now() + 60000) }, user: { _id: 'u1' } }, res);
    expect(res.statusCode).toBe(409); expect(res.body.code).toBe('OWNER_CANNOT_APPLY'); expect(Application.create).not.toHaveBeenCalled();
  });
  test('ignore statut, propriétaire et candidat injectés par le client', async () => {
    Property.findById.mockReturnValue(selected({ _id: 'p1', owner: 'owner', status: 'vente', statusAdmin: 'Validée', availability: 'Disponible', isPublished: true, title: 'Bien' }));
    Application.create.mockImplementation(async (payload) => payload);
    const res = response(); await controller.create({ body: { propertyId: 'p1', amount: 10, validUntil: new Date(Date.now() + 60000), status: 'accepted', owner: 'evil', applicant: 'evil' }, user: { _id: 'client' } }, res);
    expect(Application.create).toHaveBeenCalledWith(expect.objectContaining({ owner: 'owner', applicant: 'client' }));
    expect(Application.create.mock.calls[0][0]).not.toHaveProperty('status');
  });
  test('un client ne peut consulter le dossier d’un autre utilisateur', async () => {
    const query = { populate: jest.fn() }; query.populate.mockReturnValueOnce(query).mockReturnValueOnce(query).mockReturnValueOnce(Promise.resolve({ applicant: { _id: 'other' }, owner: 'owner', toObject: () => ({ attachments: [] }) }));
    const selectQuery = { populate: query.populate }; Application.findById.mockReturnValue({ select: jest.fn(() => selectQuery) });
    const res = response(); await controller.getOne({ params: { id: 'a1' }, user: { _id: 'client', role: 'Client' } }, res);
    expect(res.statusCode).toBe(403);
  });
  test('un client ne peut appeler la décision staff', async () => {
    Application.findById.mockResolvedValue({ owner: 'owner', applicant: 'client', status: 'submitted' });
    const res = response(); await controller.reject({ params: { id: 'a1' }, body: { reason: 'non' }, user: { _id: 'client', role: 'Client' } }, res);
    expect(res.statusCode).toBe(403);
  });
});
