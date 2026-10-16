import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TenantLeasePoliciesPanel from '../components/tenant/TenantLeasePoliciesPanel';
import * as portal from '../services/tenantPortalService';

vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../services/tenantPortalService', () => ({ getTenantLeasePolicies: vi.fn(), presentTenantLeasePolicy: vi.fn(), acceptTenantLeasePolicy: vi.fn() }));

const policy = { id: 'P1', type: 'ALTITUDE_DELEGATED', version: 1, effectiveFrom: '2026-07-01T00:00:00Z', consentRequired: true, consent: { status: 'NOT_PRESENTED' } };
const presentation = { document: { title: 'Conditions — gestion déléguée Altitude Vision', clauses: ['Pénalité de retard : 3 % du loyer principal restant impayé.'], documentReference: 'CG-AV', legalNotice: 'Acceptation électronique authentifiée.' }, documentHash: 'abc123', presentationToken: 'tok' };

beforeEach(() => vi.clearAllMocks());

test('F-U2.13 locataire : consultation complète puis acceptation explicite (case non cochée par défaut)', async () => {
  portal.getTenantLeasePolicies.mockResolvedValue([policy]);
  portal.presentTenantLeasePolicy.mockResolvedValue(presentation);
  portal.acceptTenantLeasePolicy.mockResolvedValue({ status: 'ACCEPTED' });
  render(<TenantLeasePoliciesPanel />);
  fireEvent.click(await screen.findByRole('button', { name: 'Consulter et accepter' }));
  expect(await screen.findByText(/3 % du loyer principal/)).toBeInTheDocument();
  const acceptButton = screen.getByRole('button', { name: 'Accepter les conditions' });
  expect(screen.getByRole('checkbox')).not.toBeChecked();
  expect(acceptButton).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(acceptButton);
  await waitFor(() => expect(portal.acceptTenantLeasePolicy).toHaveBeenCalledWith('P1', expect.objectContaining({ presentationToken: 'tok', documentHash: 'abc123' })));
});

test('F-U2.13 locataire : conditions du bailleur autonome, consultation sans acceptation plateforme', async () => {
  portal.getTenantLeasePolicies.mockResolvedValue([{ ...policy, type: 'OWNER_AUTONOMOUS', consentRequired: false, consent: { status: 'NOT_REQUIRED' } }]);
  portal.presentTenantLeasePolicy.mockResolvedValue({ ...presentation, presentationToken: undefined });
  render(<TenantLeasePoliciesPanel />);
  expect(await screen.findByText(/Conditions convenues avec votre bailleur/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Consulter' }));
  await screen.findByRole('dialog');
  expect(screen.queryByRole('button', { name: 'Accepter les conditions' })).not.toBeInTheDocument();
});
