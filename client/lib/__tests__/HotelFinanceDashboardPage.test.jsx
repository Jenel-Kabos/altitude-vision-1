import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import HotelFinanceDashboardPage from '../pages/dashboard/HotelFinanceDashboardPage';
import * as dashboardService from '../services/hotelFinancialDashboardService';
import * as hotelAccessService from '../services/hotelAccessService';

vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../services/hotelFinancialDashboardService', () => ({
  getHotelFinancialDashboardSummary: vi.fn(),
  getHotelFinancialDashboardTrends: vi.fn(),
  getHotelFinancialDashboardBreakdown: vi.fn(),
  getHotelFinancialDashboardAging: vi.fn(),
  getHotelFinancialDashboardAlerts: vi.fn(),
}));
vi.mock('../services/hotelAccessService', () => ({ getAccessibleHotels: vi.fn() }));

const summary = (overrides = {}) => ({
  period: { from: '2026-01-01T00:00:00Z', to: '2026-01-31T00:00:00Z', timezone: 'Africa/Brazzaville' },
  scope: { hotelId: null, global: true },
  currency: 'XAF', dataStatus: 'healthy', generatedAt: '2026-01-31T12:00:00Z',
  totals: { invoicedMinor: 500000, confirmedPaymentsMinor: 400000, allocatedMinor: 350000, outstandingMinor: 150000, unallocatedConfirmedMinor: 50000 },
  documents: { issuedCount: 5, unpaidCount: 1, partiallyPaidCount: 2, paidCount: 2, anomalyCount: 0, nonXafExcludedCount: 0 },
  checkout: { blockedCount: 0, overrideCount: 0 },
  delivery: { pdfReadyCount: 4, pdfMissingCount: 1, emailSentCount: 3, emailFailedCount: 0, emailUnknownCount: 0 },
  ...overrides,
});
const trends = { granularity: 'day', points: [] };
const breakdown = { dimension: 'status', rows: [] };
const aging = { basis: 'issueDate', buckets: [{ bucket: '0_7', documentCount: 0, outstandingMinor: 0 }, { bucket: '8_30', documentCount: 0, outstandingMinor: 0 }, { bucket: '31_60', documentCount: 0, outstandingMinor: 0 }, { bucket: '61_90', documentCount: 0, outstandingMinor: 0 }, { bucket: 'over_90', documentCount: 0, outstandingMinor: 0 }] };
const alerts = (items = [], total = items.length) => ({ alerts: items, pagination: { page: 1, limit: 10, total } });

describe('HotelFinanceDashboardPage F2.5', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hotelAccessService.getAccessibleHotels.mockResolvedValue({ globalAccess: true, hotels: [{ id: 'HOTEL-1', name: 'Hôtel Un' }, { id: 'HOTEL-2', name: 'Hôtel Deux' }] });
    dashboardService.getHotelFinancialDashboardSummary.mockResolvedValue({ summary: summary() });
    dashboardService.getHotelFinancialDashboardTrends.mockResolvedValue({ trends });
    dashboardService.getHotelFinancialDashboardBreakdown.mockResolvedValue({ breakdown });
    dashboardService.getHotelFinancialDashboardAging.mockResolvedValue({ aging });
    dashboardService.getHotelFinancialDashboardAlerts.mockResolvedValue(alerts());
  });

  test('affiche les cartes KPI après chargement', async () => {
    render(<HotelFinanceDashboardPage />);
    expect(await screen.findByText('500 000 XAF')).toBeInTheDocument();
    expect(screen.getByText('CA facturé')).toBeInTheDocument();
    expect(screen.getByText('Solde restant à recevoir')).toBeInTheDocument();
    expect(screen.getByText(/État des données : healthy/)).toBeInTheDocument();
  });

  test("affiche un état vide explicite quand aucune alerte n'est détectée", async () => {
    render(<HotelFinanceDashboardPage />);
    expect(await screen.findByText('Aucune anomalie financière détectée.')).toBeInTheDocument();
  });

  test('affiche un message d’accès refusé sur une erreur 403', async () => {
    dashboardService.getHotelFinancialDashboardSummary.mockRejectedValue({ response: { status: 403 } });
    render(<HotelFinanceDashboardPage />);
    expect(await screen.findByText('Accès refusé au dashboard financier.')).toBeInTheDocument();
  });

  test('signale des données partielles si une section échoue sans bloquer les KPI', async () => {
    dashboardService.getHotelFinancialDashboardTrends.mockRejectedValue(new Error('indisponible'));
    render(<HotelFinanceDashboardPage />);
    expect(await screen.findByText('500 000 XAF')).toBeInTheDocument();
    expect(await screen.findByText(/Données partielles/)).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalled();
  });

  test('pagine les alertes en rappelant le service avec la page suivante', async () => {
    dashboardService.getHotelFinancialDashboardAlerts.mockResolvedValue(alerts([
      { code: 'FINANCIAL_DASHBOARD_DOCUMENT_OUTSTANDING', severity: 'warning', title: 'Facture avec solde restant', message: 'msg', entityId: 'DOC-1' },
    ], 25));
    render(<HotelFinanceDashboardPage />);
    const next = await screen.findByRole('button', { name: 'Suivant' });
    fireEvent.click(next);
    await waitFor(() => expect(dashboardService.getHotelFinancialDashboardAlerts).toHaveBeenCalledWith(expect.objectContaining({ page: 2 })));
  });

  test('applique un raccourci de période sans requêtes en boucle incontrôlée', async () => {
    render(<HotelFinanceDashboardPage />);
    await screen.findByText('500 000 XAF');
    const callsBefore = dashboardService.getHotelFinancialDashboardSummary.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: '7 derniers jours' }));
    await waitFor(() => expect(dashboardService.getHotelFinancialDashboardSummary.mock.calls.length).toBe(callsBefore + 1));
  });

  test('le filtre hôtel déclenche un nouveau chargement scoping le hotelId', async () => {
    render(<HotelFinanceDashboardPage />);
    await screen.findByText('500 000 XAF');
    fireEvent.change(screen.getByLabelText('Hôtel'), { target: { value: 'HOTEL-1' } });
    await waitFor(() => expect(dashboardService.getHotelFinancialDashboardSummary).toHaveBeenCalledWith(expect.objectContaining({ hotelId: 'HOTEL-1' })));
  });

  test('un seul hôtel accessible est présélectionné automatiquement (sans saisie)', async () => {
    hotelAccessService.getAccessibleHotels.mockResolvedValue({ globalAccess: false, hotels: [{ id: 'HOTEL-1', name: 'Hôtel Un' }] });
    render(<HotelFinanceDashboardPage />);
    await waitFor(() => expect(dashboardService.getHotelFinancialDashboardSummary).toHaveBeenCalledWith(expect.objectContaining({ hotelId: 'HOTEL-1' })));
    expect(screen.getByLabelText('Hôtel')).toBeDisabled();
  });

  test("n'affiche jamais un hôtel non accessible dans le sélecteur", async () => {
    hotelAccessService.getAccessibleHotels.mockResolvedValue({ globalAccess: false, hotels: [{ id: 'HOTEL-1', name: 'Hôtel Un' }] });
    render(<HotelFinanceDashboardPage />);
    await screen.findByText('500 000 XAF');
    expect(screen.queryByText('Hôtel Deux')).not.toBeInTheDocument();
  });
});
