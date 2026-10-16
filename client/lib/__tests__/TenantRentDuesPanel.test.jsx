import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TenantRentDuesPanel from '../components/tenant/TenantRentDuesPanel';
import * as portal from '../services/tenantPortalService';

vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../services/tenantPortalService', () => ({ getTenantRentDues: vi.fn(), reportTenantPaymentDifficulty: vi.fn(), respondToDirectReceipt: vi.fn() }));

const item = (overrides = {}) => ({
  id: 'D1', period: '2026-04', documentNumber: 'FAC-A-2026-000001', dueDate: '2026-05-05T22:59:59.999Z', rentMinor: 150000, chargesMinor: 0, totalMinor: 150000,
  paidMinor: 100000, balanceMinor: 50000, penalty: { penaltyMinor: 1500, status: 'SIMULATED' }, payments: [{ amountMinor: 100000, confirmedAt: '2026-05-03T10:00:00Z' }],
  difficultyReport: null, canReportDifficulty: true, ...overrides,
});

beforeEach(() => vi.clearAllMocks());

test('F-U2.10 locataire : échéance du 5, payé, solde, pénalité prévisionnelle non exigible', async () => {
  portal.getTenantRentDues.mockResolvedValue({ items: [item()] });
  render(<TenantRentDuesPanel />);
  expect(await screen.findByText(/Loyer 2026-04/)).toBeInTheDocument();
  expect(screen.getByText(/Échéance : 05\/05\/2026/)).toBeInTheDocument();
  expect(screen.getByText(/Solde : 50/)).toBeInTheDocument();
  expect(screen.getByText(/non exigible à ce stade/)).toBeInTheDocument();
});

test('F-U2.10 locataire : signaler une difficulté (sans date de déclaration envoyée)', async () => {
  portal.getTenantRentDues.mockResolvedValue({ items: [item()] });
  portal.reportTenantPaymentDifficulty.mockResolvedValue({});
  render(<TenantRentDuesPanel />);
  fireEvent.click(await screen.findByRole('button', { name: 'Signaler une difficulté de paiement' }));
  fireEvent.change(screen.getByLabelText(/Explication/), { target: { value: 'Retard de salaire' } });
  fireEvent.click(screen.getByRole('button', { name: 'Envoyer le signalement' }));
  await waitFor(() => expect(portal.reportTenantPaymentDifficulty).toHaveBeenCalledWith('D1', { reason: 'Retard de salaire', proposedPaymentDate: '' }));
});

test('F-U2.10 locataire : statut du signalement affiché, action masquée', async () => {
  portal.getTenantRentDues.mockResolvedValue({ items: [item({ canReportDifficulty: false, difficultyReport: { status: 'submitted', declaredAt: '2026-05-20T10:00:00Z' } })] });
  render(<TenantRentDuesPanel />);
  expect(await screen.findByText(/transmis, en attente d’examen/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Signaler une difficulté de paiement' })).not.toBeInTheDocument();
});

test('F-U2.12 locataire : confirmer un loyer déclaré reçu par le bailleur', async () => {
  portal.getTenantRentDues.mockResolvedValue({ items: [item({ balanceMinor: 0, canReportDifficulty: false, directReceipts: [{ id: 'DR1', amountMinor: 150000, receivedAt: '2026-05-03T10:00:00Z', status: 'DECLARED', canRespond: true }] })] });
  portal.respondToDirectReceipt.mockResolvedValue({});
  render(<TenantRentDuesPanel />);
  fireEvent.click(await screen.findByRole('button', { name: 'Je confirme ce paiement' }));
  await waitFor(() => expect(portal.respondToDirectReceipt).toHaveBeenCalledWith('DR1', { decision: 'confirm', reason: null }));
});
