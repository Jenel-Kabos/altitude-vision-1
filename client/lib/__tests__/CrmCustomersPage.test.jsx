import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import CrmCustomersPage from '../pages/dashboard/CrmCustomersPage';

const getCrmCustomers = vi.fn(); const synchronizeCrmCustomers = vi.fn(); const getCrmDashboard = vi.fn();
vi.mock('../services/crmService', () => ({
  getCrmCustomers: (...args) => getCrmCustomers(...args), synchronizeCrmCustomers: (...args) => synchronizeCrmCustomers(...args), getCrmDashboard: (...args) => getCrmDashboard(...args),
  getCrmPipeline: vi.fn(), getCrmActivities: vi.fn(), searchCrm: vi.fn(), getCrmDuplicates: vi.fn(), getCrmConsolidations: vi.fn(), updateCrmActivity: vi.fn(), moveCrmOpportunity: vi.fn(), setCrmOpportunityOutcome: vi.fn(), compareCrmCustomers: vi.fn(), consolidateCrmCustomers: vi.fn(),
}));
vi.mock('next/link', () => ({ default: ({ href, children }) => <a href={href}>{children}</a> }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('') }));

describe('CRM-CORE-1 — liste Customer 360', () => {
  beforeEach(() => { vi.clearAllMocks(); getCrmCustomers.mockResolvedValue({ total: 1, customers: [{ _id: 'customer-1', displayName: 'Ada Client', company: 'Altitude', emails: ['ada@example.test'], phones: ['06111'], relations: ['locataire', 'client_altcom'], sourceRefs: [{}, {}], opportunities: { count: 1 }, status: 'active' }] }); getCrmDashboard.mockResolvedValue({ kpis: { prospects: 1, opportunities: 0, activeClients: 0, inactiveClients: 0, revenueMinor: 0, pendingQuotes: 0, contractsToSign: 0, followupsToday: 0, overdueTasks: 0, meetingsToday: 0, newContacts: 0 }, commercial: { conversionRate: null, averageCycleDays: null, won: 0, lost: 0, revenueByPole: [], bestCommercial: null, activityByCollaborator: [] } }); });
  test('affiche une seule fiche transverse et sa destination NAV-CORE', async () => {
    render(<CrmCustomersPage />); expect(await screen.findByText('Ada Client')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ada Client/i })).toHaveAttribute('href', '/dashboard/crm/customer-1');
    expect(screen.getByText(/2 source/)).toBeInTheDocument();
  });
  test('lance explicitement la consolidation puis recharge', async () => {
    synchronizeCrmCustomers.mockResolvedValue({ scanned: 3, created: 1, updated: 2, conflicts: [] });
    render(<CrmCustomersPage />); await screen.findByText('Ada Client'); fireEvent.click(screen.getByRole('button', { name: /Consolider les sources/i }));
    await waitFor(() => expect(synchronizeCrmCustomers).toHaveBeenCalledTimes(1)); expect(await screen.findByText(/3 sources analysées/)).toBeInTheDocument();
  });
});
