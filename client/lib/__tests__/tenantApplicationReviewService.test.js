import api from '../services/api';
import {
  approveTenantApplication,
  listTenantApplications,
  openTenantApplicationDocument,
  rejectTenantApplication,
  requestTenantApplicationChanges,
} from '../services/tenantApplicationReviewService';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

describe('tenantApplicationReviewService', () => {
  beforeEach(() => vi.clearAllMocks());

  test('liste avec filtres/pagination côté serveur et normalise id', async () => {
    api.get.mockResolvedValue({ data: { data: { applications: [{ _id: 'app-1' }], pagination: { page: 2 } } } });
    await expect(listTenantApplications({ page: 2, limit: 20, status: 'SUBMITTED' })).resolves.toMatchObject({ applications: [{ id: 'app-1' }] });
    expect(api.get).toHaveBeenCalledWith('/platform-tenants/applications', {
      params: { page: 2, limit: 20, status: 'SUBMITTED' },
      platformScoped: true,
    });
  });

  test('approve POST est vide de toute autorité client', async () => {
    api.post.mockResolvedValue({ data: { data: { application: { status: 'APPROVED' } } } });
    await approveTenantApplication('app-1');
    expect(api.post).toHaveBeenCalledWith(
      '/platform-tenants/applications/app-1/approve',
      undefined,
      { platformScoped: true },
    );
  });

  test('reject et request-changes utilisent uniquement leurs décisions certifiées', async () => {
    api.post.mockResolvedValue({ data: { data: { application: { id: 'app-1' } } } });
    await rejectTenantApplication('app-1', 'Motif public.');
    expect(api.post).toHaveBeenCalledWith(
      '/platform-tenants/applications/app-1/reject',
      { reason: 'Motif public.' },
      { platformScoped: true },
    );
    const payload = { reason: 'Compléter.', requestedFields: ['organizationName'], requestedDocumentCategories: [] };
    await requestTenantApplicationChanges('app-1', payload);
    expect(api.post).toHaveBeenCalledWith(
      '/platform-tenants/applications/app-1/request-changes',
      payload,
      { platformScoped: true },
    );
  });

  test('document privé passe par review-documents et URL éphémère révoquée', async () => {
    vi.useFakeTimers();
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:private-review');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const open = vi.spyOn(window, 'open').mockReturnValue({});
    api.get.mockResolvedValue({ data: new Blob(['pdf'], { type: 'application/pdf' }) });
    await openTenantApplicationDocument('app-1', { id: 'doc-1', mimeType: 'application/pdf' });
    expect(api.get).toHaveBeenCalledWith('/platform-tenants/applications/app-1/review-documents/doc-1', {
      responseType: 'blob',
      platformScoped: true,
    });
    expect(open).toHaveBeenCalledWith('blob:private-review', '_blank', 'noopener,noreferrer');
    expect(localStorage.length).toBe(0);
    vi.advanceTimersByTime(60_000);
    expect(revoke).toHaveBeenCalledWith('blob:private-review');
    create.mockRestore(); revoke.mockRestore(); open.mockRestore(); vi.useRealTimers();
  });
});
