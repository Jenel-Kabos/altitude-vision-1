jest.mock('../services/accommodation/mobileAccommodationPublicationService', () => ({
  createFullMobileAccommodation: jest.fn(),
}));
jest.mock('../controllers/propertyController', () => ({
  uploadFilesToCloudinary: jest.fn().mockResolvedValue(['https://cdn.test/hotel.jpg']),
  parseAmenities: jest.fn(), parseStringArray: jest.fn(), parseNonNegativeAmount: jest.fn(),
  parseAddress: jest.fn(), parseGeoLocation: jest.fn(), buildBasePropertyData: jest.fn(),
}));
jest.mock('../services/notificationService', () => ({ notify: jest.fn() }));
jest.mock('../services/actionLogService', () => ({ logAction: jest.fn(), buildAuteur: jest.fn() }));

const { createFullMobileAccommodation } = require('../services/accommodation/mobileAccommodationPublicationService');
const controller = require('../controllers/hotelController');

const response = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

test('le formulaire Web multipart délègue au service transactionnel Mobile et renvoie toutes les relations', async () => {
  const payload = {
    publicationRequestId: 'web-1', publicationKind: 'hotel_establishment',
    property: { titre: 'Altitude Hôtel', prix: 35000, photos: [] },
    accommodation: { hotel: { name: 'Altitude Hôtel' } }, roomCategories: [{ code: 'STD' }, { code: 'STE' }],
  };
  const result = {
    property: { price: 35000 }, accommodation: { _id: 'a1' }, hotel: { totalRooms: 18 },
    roomCategories: [{ _id: 'c1' }, { _id: 'c2' }], categoryRates: [{ roomCategory: 'c1' }, { roomCategory: 'c2' }],
    rate: { roomCategory: 'c1' }, idempotent: false,
  };
  createFullMobileAccommodation.mockResolvedValue(result);
  const req = { user: { id: 'u1' }, files: [{ buffer: Buffer.from('image') }], body: { publicationRequestId: 'web-1', publicationPayload: JSON.stringify(payload) } };
  const res = response();

  await controller.createFull(req, res);

  expect(createFullMobileAccommodation).toHaveBeenCalledWith(expect.objectContaining({
    user: req.user, publicationRequestId: 'web-1',
    payload: expect.objectContaining({
      publicationKind: 'hotel_establishment',
      property: expect.objectContaining({ photos: ['https://cdn.test/hotel.jpg'] }),
      roomCategories: payload.roomCategories,
    }),
  }));
  expect(res.status).toHaveBeenCalledWith(201);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
    property: result.property, accommodation: result.accommodation, hotel: result.hotel,
    roomCategories: result.roomCategories, categoryRates: result.categoryRates,
  }) }));
});
