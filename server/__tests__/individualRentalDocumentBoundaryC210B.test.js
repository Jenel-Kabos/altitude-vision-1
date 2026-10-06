jest.mock('../models/Contrat');
jest.mock('../services/rentalIndividualResourceAccessService', () => ({ assertIndividualRentalResourceAccess: jest.fn() }));
jest.mock('../services/storage/secureStorageService', () => ({ readPrivateAsset: jest.fn() }));
jest.mock('../services/storage/documentStreamingService', () => ({ safeFilename: jest.fn((x) => x), streamRemoteDocument: jest.fn() }));
jest.mock('../utils/logger', () => ({ warn: jest.fn(), info: jest.fn(), error: jest.fn() }));

const Contrat = require('../models/Contrat');
const { assertIndividualRentalResourceAccess } = require('../services/rentalIndividualResourceAccessService');
const { streamRemoteDocument } = require('../services/storage/documentStreamingService');
const ctrl = require('../controllers/rentalDocumentController');

const documentId = '507f1f77bcf86cd799439011';
const query = (value) => ({ select: jest.fn().mockReturnThis(), populate: jest.fn().mockReturnThis(), then: (resolve) => Promise.resolve(value).then(resolve) });
const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis(), setHeader: jest.fn(), send: jest.fn() });

test('un document locatif individuel exige aussi l’entitlement du propriétaire', async () => {
  const doc = { _id: documentId, nom: 'Bail', url: 'https://example.test/bail.pdf' };
  Contrat.findOne.mockReturnValue(query({
    _id: '507f1f77bcf86cd799439012', type: 'location',
    bien: { _id: '507f1f77bcf86cd799439013', owner: '507f1f77bcf86cd799439014', tenant: null },
    locataire: null, documents: { id: () => doc },
  }));
  assertIndividualRentalResourceAccess.mockRejectedValue(Object.assign(new Error('Abonnement requis'), { statusCode: 403, code: 'INDIVIDUAL_ENTITLEMENT_REQUIRED' }));
  const res = response();
  await ctrl.download({ params: { documentId }, query: {}, user: { _id: '507f1f77bcf86cd799439014', role: 'Proprietaire' } }, res);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(streamRemoteDocument).not.toHaveBeenCalled();
});
