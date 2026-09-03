import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TenantApplicationsPage from '../pages/dashboard/TenantApplicationsPage';
import * as service from '../services/tenantApplicationReviewService';

vi.mock('../services/tenantApplicationReviewService', () => ({
  listTenantApplications: vi.fn(),
  getTenantApplication: vi.fn(),
  openTenantApplicationDocument: vi.fn(),
  startTenantApplicationReview: vi.fn(),
  requestTenantApplicationChanges: vi.fn(),
  rejectTenantApplication: vi.fn(),
  approveTenantApplication: vi.fn(),
}));

let capabilities = [];
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ can: (capability) => capabilities.includes(capability) }),
}));

const row = { id: 'app-1', organizationName: 'Groupe Panorama', status: 'SUBMITTED', submittedAt: '2026-09-01T10:00:00Z', updatedAt: '2026-09-02T10:00:00Z' };
const detail = {
  ...row,
  organizationType: 'Entreprise',
  applicant: { name: 'Propriétaire test', email: 'owner@example.test', role: 'Proprietaire' },
  professionalContact: { email: 'contact@example.test', phone: '+242000000000', city: 'Brazzaville', country: 'Congo' },
  businessDeclaration: 'Exploitation hôtelière.',
  establishmentContext: { name: 'Hôtel Panorama', city: 'Brazzaville' },
  documents: [{ id: 'doc-1', category: 'responsible_person_identity', revision: 1, displayName: 'identite.pdf', mimeType: 'application/pdf' }],
  history: [{ from: 'DRAFT', to: 'SUBMITTED', at: '2026-09-01T10:00:00Z' }],
};

describe('TenantApplicationsPage — modération plateforme', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capabilities = ['platform.tenant_applications.read'];
    service.listTenantApplications.mockResolvedValue({ applications: [row], pagination: { page: 1, pages: 2, total: 21 } });
    service.getTenantApplication.mockResolvedValue(detail);
  });

  test('READ charge la liste paginée et le détail sans action de mutation', async () => {
    render(<TenantApplicationsPage />);
    expect(await screen.findByText('Groupe Panorama')).toBeInTheDocument();
    expect(service.listTenantApplications).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 20 }));
    fireEvent.click(screen.getByRole('button', { name: /Consulter Groupe Panorama/i }));
    expect(await screen.findByText('Exploitation hôtelière.')).toBeInTheDocument();
    expect(screen.getByText('Identité du responsable')).toBeInTheDocument();
    expect(screen.getByText(/Version 1/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Commencer l’examen/i })).not.toBeInTheDocument();
  });

  test('sans capacité read, la page échoue fermée et ne charge rien', () => {
    capabilities = [];
    render(<TenantApplicationsPage />);
    expect(screen.getByText('Accès non autorisé')).toBeInTheDocument();
    expect(service.listTenantApplications).not.toHaveBeenCalled();
  });

  test('review appelle uniquement start-review puis recharge le détail', async () => {
    capabilities.push('platform.tenant_applications.review');
    service.startTenantApplicationReview.mockResolvedValue({ ...detail, status: 'UNDER_REVIEW' });
    render(<TenantApplicationsPage />);
    fireEvent.click(await screen.findByRole('button', { name: /Consulter Groupe Panorama/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Commencer l’examen/i }));
    await waitFor(() => expect(service.startTenantApplicationReview).toHaveBeenCalledWith('app-1'));
    expect(service.getTenantApplication).toHaveBeenCalledTimes(2);
  });

  test('les filtres sont envoyés au serveur avec pagination', async () => {
    render(<TenantApplicationsPage />);
    await screen.findByText('Groupe Panorama');
    fireEvent.change(screen.getByLabelText('Statut'), { target: { value: 'SUBMITTED' } });
    fireEvent.change(screen.getByLabelText('Organisation'), { target: { value: 'Panorama' } });
    fireEvent.change(screen.getByLabelText('Identifiant demandeur'), { target: { value: '507f1f77bcf86cd799439011' } });
    fireEvent.click(screen.getByRole('button', { name: 'Filtrer' }));
    await waitFor(() => expect(service.listTenantApplications).toHaveBeenLastCalledWith(expect.objectContaining({
      status: 'SUBMITTED', organizationName: 'Panorama', applicant: '507f1f77bcf86cd799439011', page: 1, limit: 20,
    })));
  });

  test('complément impose message et allowlists puis appelle l’opération canonique', async () => {
    capabilities.push('platform.tenant_applications.request_changes');
    service.getTenantApplication.mockResolvedValue({ ...detail, status: 'UNDER_REVIEW' });
    service.requestTenantApplicationChanges.mockResolvedValue({ ...detail, status: 'ADDITIONAL_INFO_REQUIRED' });
    render(<TenantApplicationsPage />);
    fireEvent.click(await screen.findByRole('button', { name: /Consulter Groupe Panorama/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Demander un complément' }));
    fireEvent.click(screen.getByLabelText('Déclaration d’activité'));
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer la demande' }));
    expect(service.requestTenantApplicationChanges).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Message communiqué au demandeur'), { target: { value: 'Précisez votre activité.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer la demande' }));
    await waitFor(() => expect(service.requestTenantApplicationChanges).toHaveBeenCalledWith('app-1', {
      reason: 'Précisez votre activité.', requestedFields: ['businessDeclaration'], requestedDocumentCategories: [],
    }));
  });

  test('approve exige confirmation, envoie zéro autorité client et protège le double clic', async () => {
    capabilities.push('platform.tenant_applications.approve');
    service.getTenantApplication.mockResolvedValue({ ...detail, status: 'UNDER_REVIEW' });
    service.approveTenantApplication.mockResolvedValue({ application: { ...detail, status: 'APPROVED' }, organization: { provisioned: true } });
    render(<TenantApplicationsPage />);
    fireEvent.click(await screen.findByRole('button', { name: /Consulter Groupe Panorama/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Approuver et activer/i }));
    expect(service.approveTenantApplication).not.toHaveBeenCalled();
    const confirm = screen.getByRole('button', { name: 'Confirmer l’approbation' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await waitFor(() => expect(service.approveTenantApplication).toHaveBeenCalledTimes(1));
    expect(service.approveTenantApplication).toHaveBeenCalledWith('app-1');
  });

  test('un conflit de rejet déclenche un refetch sans faux succès', async () => {
    capabilities.push('platform.tenant_applications.reject');
    service.getTenantApplication.mockResolvedValue({ ...detail, status: 'UNDER_REVIEW' });
    service.rejectTenantApplication.mockRejectedValue({ response: { status: 409, data: { code: 'TENANT_APPLICATION_TRANSITION_CONFLICT' } } });
    render(<TenantApplicationsPage />);
    fireEvent.click(await screen.findByRole('button', { name: /Consulter Groupe Panorama/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Rejeter la demande/i }));
    fireEvent.change(screen.getByLabelText('Motif communiqué au demandeur'), { target: { value: 'Justificatifs non vérifiables.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer le rejet' }));
    expect(await screen.findByText(/modifiée par un autre opérateur/i)).toBeInTheDocument();
    expect(service.getTenantApplication).toHaveBeenCalledTimes(2);
  });

  test('un rejet confirmé ne transmet que le motif applicant-safe', async () => {
    capabilities.push('platform.tenant_applications.reject');
    service.getTenantApplication.mockResolvedValue({ ...detail, status: 'UNDER_REVIEW' });
    service.rejectTenantApplication.mockResolvedValue({ ...detail, status: 'REJECTED', rejectionReason: 'Dossier non vérifiable.' });
    render(<TenantApplicationsPage />);
    fireEvent.click(await screen.findByRole('button', { name: /Consulter Groupe Panorama/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Rejeter la demande/i }));
    fireEvent.change(screen.getByLabelText('Motif communiqué au demandeur'), { target: { value: 'Dossier non vérifiable.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer le rejet' }));
    await waitFor(() => expect(service.rejectTenantApplication).toHaveBeenCalledWith('app-1', 'Dossier non vérifiable.'));
  });
});
