jest.mock('../api', () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock('../cacheService', () => ({ cache: { get: jest.fn(), set: jest.fn() } }));
jest.mock('../tenantPortalService', () => ({ downloadTenantDocument: jest.fn() }));
jest.mock('../accommodationReservationService', () => ({ downloadFinancialDocument: jest.fn() }));

import api from '../api';
import { cache } from '../cacheService';
import { getPersonalDocument, getPersonalDocuments } from '../personalDocumentService';

describe('coffre documentaire personnel', () => {
  beforeEach(() => { jest.clearAllMocks(); cache.get.mockReturnValue(null); });

  test('agrège uniquement les projections personnelles des APIs existantes', async () => {
    api.get.mockImplementation((path) => {
      if (path === '/tenant-portal/documents') return Promise.resolve({ data: { data: { documents: [{ _id: 'lease-doc', leaseId: 'lease-1', nom: 'Bail', type: 'bail', dateGeneration: '2026-01-01' }] } } });
      if (path === '/accommodation-reservations') return Promise.resolve({ data: { data: { reservations: [{ _id: 'acc-r', financialDocument: 'acc-doc', accommodation: { property: { title: 'Villa' } } }] } } });
      if (path === '/financial/documents/acc-doc') return Promise.resolve({ data: { data: { document: { id: 'acc-doc', documentType: 'invoice', totalMinor: 1000, currency: 'XAF' } } } });
      if (path === '/hotel-reservations/mine') return Promise.resolve({ data: { data: { reservations: [] } } });
      if (path === '/hotel-reservations/owner') return Promise.reject({ response: { status: 403 } });
      throw new Error(path);
    });
    const result = await getPersonalDocuments({ refresh: true });
    expect(result.documents.map((item) => item.id)).toEqual(['rental:lease-doc', 'financial:acc-doc']);
    expect(result.documents.every((item) => item.category !== 'Administration')).toBe(true);
    expect(cache.set).toHaveBeenCalled();
  });

  test('retrouve un document depuis un identifiant NAV brut', async () => {
    cache.get.mockReturnValue([{ id: 'rental:doc-1', documentId: 'doc-1' }]);
    await expect(getPersonalDocument('doc-1')).resolves.toEqual({ document: { id: 'rental:doc-1', documentId: 'doc-1' }, offline: false });
  });
});
