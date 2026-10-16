import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import FinancialKycPersonalPage from '../pages/FinancialKycPersonalPage';
import FinancialKycOrganizationPage from '../pages/dashboard/FinancialKycOrganizationPage';
import FinancialKycReviewPage from '../pages/dashboard/FinancialKycReviewPage';
import * as kyc from '../services/financialKycService';
import { listMembers } from '../services/tenantMemberService';

vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { _id: 'U1', name: 'Personne fictive' } }) }));
vi.mock('../services/tenantMemberService', () => ({ listMembers: vi.fn() }));
vi.mock('../services/financialKycService', () => ({
  getKycProcedure: vi.fn(), listKycCases: vi.fn(), createKycCase: vi.fn(), updateKycCase: vi.fn(), uploadKycDocument: vi.fn(),
  acknowledgeKycNotice: vi.fn(), submitKycCase: vi.fn(), cancelKycCase: vi.fn(), fetchKycDocumentBlob: vi.fn(),
  listKycReviewQueue: vi.fn(), getKycReviewCase: vi.fn(), takeKycCase: vi.fn(), requestKycInformation: vi.fn(), checkKycDocument: vi.fn(),
  approveKycCase: vi.fn(), rejectKycCase: vi.fn(), suspendKycAttestation: vi.fn(), revokeKycAttestation: vi.fn(),
}));

const procedure = { version: 'P1', acceptedDocuments: { NATIONAL_ID: ['ID_FRONT', 'ID_BACK'], PASSPORT: ['PASSPORT_DATA_PAGE'] }, privacyNotice: { version: 'N1', purpose: 'Finalité fictive', recipients: 'Agents', retention: 'À valider' } };
const baseCase = (overrides = {}) => ({
  id: 'C1', subject: 'U1', status: 'ready_for_submission', revision: 3, purpose: 'OWNER_FINANCIAL_OPERATIONS', applicantType: 'INDIVIDUAL',
  personal: { lastName: 'Fictif', firstNames: 'Test' }, identityDocument: { kind: 'NATIONAL_ID', issuingCountry: 'CG', expiresAt: '2030-01-01', numberHint: '•••678', numberProvided: true },
  requiredSlots: ['ID_FRONT', 'ID_BACK'], documents: [{ docId: 'D1', slot: 'ID_FRONT', status: 'current', review: { result: 'pending' } }, { docId: 'D2', slot: 'ID_BACK', status: 'current', review: { result: 'pending' } }],
  privacyNoticeAccepted: false, informationRequests: [], decision: null, ...overrides,
});

beforeEach(() => { vi.clearAllMocks(); kyc.getKycProcedure.mockResolvedValue(procedure); });

test('espace personnel : numéro jamais réaffiché, information à accepter avant soumission', async () => {
  kyc.listKycCases.mockResolvedValue([baseCase()]);
  kyc.acknowledgeKycNotice.mockResolvedValue(baseCase({ privacyNoticeAccepted: true }));
  render(<FinancialKycPersonalPage />);
  expect(await screen.findByText(/enregistré : •••678/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Soumettre à Altitude Vision' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /J’ai pris connaissance/ }));
  await waitFor(() => expect(kyc.acknowledgeKycNotice).toHaveBeenCalledWith('C1', 'N1'));
  expect(await screen.findByRole('button', { name: 'Soumettre à Altitude Vision' })).toBeInTheDocument();
});

test('espace personnel : dossier soumis en lecture seule, aucune action d’édition', async () => {
  kyc.listKycCases.mockResolvedValue([baseCase({ status: 'under_review', privacyNoticeAccepted: true })]);
  render(<FinancialKycPersonalPage />);
  expect(await screen.findByText('En cours d’examen', { selector: 'span' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Enregistrer' })).not.toBeInTheDocument();
  expect(screen.queryByText('Remplacer')).not.toBeInTheDocument();
});

test('organisation : prépare pour un membre ; ne voit jamais d’action d’attestation', async () => {
  kyc.listKycCases.mockResolvedValue([baseCase({ id: 'C2', subject: 'M1', status: 'draft' })]);
  listMembers.mockResolvedValue([{ status: 'active', user: { _id: 'M1', name: 'Membre fictif' } }]);
  kyc.createKycCase.mockResolvedValue({ id: 'C3' });
  render(<FinancialKycOrganizationPage />);
  fireEvent.change(await screen.findByLabelText('Membre concerné'), { target: { value: 'M1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Préparer un dossier' }));
  await waitFor(() => expect(kyc.createKycCase).toHaveBeenCalledWith({ purpose: 'SENSITIVE_FINANCIAL_GRANT', subjectUserId: 'M1' }));
  fireEvent.click(screen.getByRole('button', { name: /Membre fictif/ }));
  expect(await screen.findByText(/doit accepter cette information depuis son propre espace/)).toBeInTheDocument();
  expect(screen.queryByText(/Attester/)).not.toBeInTheDocument();
});

test('vue plateforme sans habilitation : accès réservé, aucun justificatif affiché', async () => {
  kyc.listKycReviewQueue.mockRejectedValue({ response: { status: 403 } });
  render(<FinancialKycReviewPage />);
  expect(await screen.findByText('Accès réservé')).toBeInTheDocument();
  expect(kyc.getKycReviewCase).not.toHaveBeenCalled();
});

test('vérificateur habilité : décision motivée envoyée au serveur', async () => {
  kyc.listKycReviewQueue.mockResolvedValue([{ id: 'C1', status: 'under_review', applicantType: 'INDIVIDUAL', documentKind: 'NATIONAL_ID' }]);
  kyc.getKycReviewCase.mockResolvedValue({ ...baseCase({ status: 'under_review' }), history: [], accessLog: [] });
  kyc.approveKycCase.mockResolvedValue({});
  vi.spyOn(window, 'prompt').mockReturnValue('Pièces fictives conformes');
  render(<FinancialKycReviewPage />);
  fireEvent.click(await screen.findByRole('button', { name: /Carte nationale/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Attester l’identité' }));
  await waitFor(() => expect(kyc.approveKycCase).toHaveBeenCalledWith('C1', 'Pièces fictives conformes'));
});
