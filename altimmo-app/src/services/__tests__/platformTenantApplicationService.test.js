const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPatch = jest.fn();
const mockDelete = jest.fn();

jest.mock('../api', () => ({
  __esModule: true,
  default: { get: (...args) => mockGet(...args), post: (...args) => mockPost(...args), patch: (...args) => mockPatch(...args), delete: (...args) => mockDelete(...args) },
}));
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/', EncodingType: { Base64: 'base64' }, writeAsStringAsync: jest.fn(),
}));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn().mockResolvedValue(false), shareAsync: jest.fn() }));

const service = require('../platformTenantService');

describe('platformTenantService — TenantApplication mobile contract', () => {
  beforeEach(() => jest.clearAllMocks());

  test('uses the canonical read-only applicant status endpoint', async () => {
    mockGet.mockResolvedValue({ data: { data: { state: 'NO_APPLICATION' } } });
    await expect(service.getFirstOrganizationOnboardingStatus()).resolves.toBe('NO_APPLICATION');
    expect(mockGet).toHaveBeenCalledWith('/platform-tenants/applications/me/status');
  });

  test('creates and edits only through application endpoints', async () => {
    const fields = { organizationName: 'Panorama' };
    mockPost.mockResolvedValue({ data: { data: { application: { id: 'app-1' } } } });
    mockPatch.mockResolvedValue({ data: { data: { application: { id: 'app-1' } } } });
    await service.createTenantApplication(fields);
    await service.updateTenantApplication('app-1', fields);
    expect(mockPost).toHaveBeenCalledWith('/platform-tenants/applications', fields);
    expect(mockPatch).toHaveBeenCalledWith('/platform-tenants/applications/app-1', fields);
  });

  test('uploads only category and the selected file descriptor', async () => {
    const append = jest.spyOn(FormData.prototype, 'append');
    mockPost.mockResolvedValue({ data: { data: { document: { id: 'doc-1' } } } });
    await service.uploadTenantApplicationDocument('app-1', 'responsible_person_identity', {
      uri: 'file:///proof.pdf', name: 'proof.pdf', mimeType: 'application/pdf',
    });
    expect(mockPost.mock.calls[0][0]).toBe('/platform-tenants/applications/app-1/documents');
    expect(append).toHaveBeenCalledWith('category', 'responsible_person_identity');
    expect(append).toHaveBeenCalledWith('document', expect.objectContaining({
      uri: 'file:///proof.pdf', name: 'proof.pdf', type: 'application/pdf',
    }));
    append.mockRestore();
  });

  test('submit and delete remain application-scoped', async () => {
    mockPost.mockResolvedValue({ data: { data: { application: { status: 'SUBMITTED' } } } });
    mockDelete.mockResolvedValue({ status: 204 });
    await service.submitTenantApplication('app-1');
    await service.deleteTenantApplicationDocument('app-1', 'doc-1');
    expect(mockPost).toHaveBeenCalledWith('/platform-tenants/applications/app-1/submit');
    expect(mockDelete).toHaveBeenCalledWith('/platform-tenants/applications/app-1/documents/doc-1');
  });
});
