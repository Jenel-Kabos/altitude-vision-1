// TENANT-DATA-ISOLATION-SALES-RENTALS-1B — le changement de tenant depuis
// PlatformOperatorContextSwitcher doit re-fire les fetchs Sales/Rentals et
// invalider immédiatement les données du tenant précédent. Une réponse
// tardive du tenant précédent ne peut jamais écraser l'état du nouveau scope.

import { act, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ManagePropertiesPage from '../pages/dashboard/ManagePropertiesPage';
import * as propertyService from '../services/propertyService';
import * as analyticsService from '../services/dashboardAnalyticsService';
import { getPortfolioDashboard } from '../services/propertyAssetService';

let mockSelectedTenantId = 'tenant-A';

vi.mock('../services/propertyService', () => ({
  getAllProperties: vi.fn(), getPropertyById: vi.fn(), deleteProperty: vi.fn(),
  updateProperty: vi.fn(), addProperty: vi.fn(), toggleRecommande: vi.fn(),
}));
vi.mock('../services/accommodationService', () => ({
  createFullAccommodation: vi.fn(), updateFullAccommodation: vi.fn(),
}));
vi.mock('../services/dashboardAnalyticsService', () => ({
  getDashboardAnalytics: vi.fn(),
}));
// Garder le composant patrimoine réel, mais isoler son transport réseau
// comme les services de liste et d'analytics utilisés par cette page.
vi.mock('../services/propertyAssetService', () => ({ getPortfolioDashboard: vi.fn() }));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ canEdit: true, canDelete: true, user: { role: 'Admin' } }),
}));
vi.mock('../context/PlatformTenantRuntimeContext', () => ({
  usePlatformTenantRuntime: () => ({ selectedTenantId: mockSelectedTenantId, tenants: [] }),
}));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next/link', () => ({ default: ({ children, href }) => <a href={href}>{children}</a> }));
// Neutralize heavy component imports :
vi.mock('../components/dashboard/PropertyForm', () => ({ default: () => null }));
vi.mock('../components/dashboard/SalePropertyForm', () => ({ default: () => null }));
vi.mock('../components/dashboard/RentalPropertyForm', () => ({ default: () => null }));
vi.mock('../components/dashboard/AccommodationPropertyForm', () => ({ default: () => null }));
vi.mock('../components/dashboard/HotelPropertyForm', () => ({ default: () => null }));

const kpisA = { kpis: { active: 1, published: 1, sold: 0, drafts: 0, salesAmount: 150000, commissions: 7500, scheduledVisits: 0, pendingOffers: 0 } };
const kpisB = { kpis: { active: 5, published: 3, sold: 2, drafts: 0, salesAmount: 80000000, commissions: 4000000, scheduledVisits: 4, pendingOffers: 1 } };
const listA = [{ _id: 'p-a', title: 'Bien Altitude', status: 'vente', price: 150000, address: {} }];
const listB = [{ _id: 'p-b1', title: 'Bien Mila 1', status: 'vente', price: 80000000, address: {} }];

beforeEach(() => {
  vi.resetAllMocks();
  mockSelectedTenantId = 'tenant-A';
  getPortfolioDashboard.mockResolvedValue(null);
});

describe('ManagePropertiesPage — refetch on tenant switch (Sales)', () => {
  test('FE-ISO-01 · FE-ISO-02: initial Tenant A fetch, switch A → B triggers new fetch', async () => {
    propertyService.getAllProperties.mockResolvedValueOnce(listA);
    analyticsService.getDashboardAnalytics.mockResolvedValueOnce(kpisA);
    const { rerender } = render(<ManagePropertiesPage section="vente" />);
    await waitFor(() => expect(analyticsService.getDashboardAnalytics).toHaveBeenCalledTimes(1));
    expect(analyticsService.getDashboardAnalytics).toHaveBeenCalledWith('sales');

    // Switch to Tenant B
    mockSelectedTenantId = 'tenant-B';
    propertyService.getAllProperties.mockResolvedValueOnce(listB);
    analyticsService.getDashboardAnalytics.mockResolvedValueOnce(kpisB);
    rerender(<ManagePropertiesPage section="vente" />);
    await waitFor(() => expect(analyticsService.getDashboardAnalytics).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(propertyService.getAllProperties).toHaveBeenCalledTimes(2));
  });

  test('FE-ISO-05: late Tenant A response cannot overwrite Tenant B state', async () => {
    // Tenant A resolves LATER than B.
    let resolveA;
    propertyService.getAllProperties.mockImplementationOnce(() => new Promise((r) => { resolveA = r; }));
    let resolveAnalyticsA;
    analyticsService.getDashboardAnalytics.mockImplementationOnce(() => new Promise((r) => { resolveAnalyticsA = r; }));

    const { rerender } = render(<ManagePropertiesPage section="vente" />);
    await waitFor(() => expect(propertyService.getAllProperties).toHaveBeenCalledTimes(1));

    // Switch to B mid-flight
    mockSelectedTenantId = 'tenant-B';
    propertyService.getAllProperties.mockResolvedValueOnce(listB);
    analyticsService.getDashboardAnalytics.mockResolvedValueOnce(kpisB);
    rerender(<ManagePropertiesPage section="vente" />);
    await waitFor(() => expect(propertyService.getAllProperties).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText('Bien Mila 1')).toBeInTheDocument());

    // Now the late Tenant A responses arrive — must be IGNORED.
    await act(async () => { resolveA(listA); resolveAnalyticsA(kpisA); });
    expect(screen.queryByText('Bien Altitude')).not.toBeInTheDocument();
    expect(screen.getByText('Bien Mila 1')).toBeInTheDocument();
  });

  test('FE-ISO-06: switch B → A refetches A', async () => {
    propertyService.getAllProperties.mockResolvedValueOnce(listA);
    analyticsService.getDashboardAnalytics.mockResolvedValueOnce(kpisA);
    const { rerender } = render(<ManagePropertiesPage section="vente" />);
    await waitFor(() => expect(analyticsService.getDashboardAnalytics).toHaveBeenCalledTimes(1));

    mockSelectedTenantId = 'tenant-B';
    propertyService.getAllProperties.mockResolvedValueOnce(listB);
    analyticsService.getDashboardAnalytics.mockResolvedValueOnce(kpisB);
    rerender(<ManagePropertiesPage section="vente" />);
    await waitFor(() => expect(analyticsService.getDashboardAnalytics).toHaveBeenCalledTimes(2));

    mockSelectedTenantId = 'tenant-A';
    propertyService.getAllProperties.mockResolvedValueOnce(listA);
    analyticsService.getDashboardAnalytics.mockResolvedValueOnce(kpisA);
    rerender(<ManagePropertiesPage section="vente" />);
    await waitFor(() => expect(analyticsService.getDashboardAnalytics).toHaveBeenCalledTimes(3));
  });
});

describe('ManagePropertiesPage — refetch on tenant switch (Rentals)', () => {
  test('FE-ISO-07 · FE-ISO-08: rentals also refetch on tenant switch', async () => {
    propertyService.getAllProperties.mockResolvedValueOnce(listA);
    analyticsService.getDashboardAnalytics.mockResolvedValueOnce(kpisA);
    const { rerender } = render(<ManagePropertiesPage section="location" />);
    await waitFor(() => expect(analyticsService.getDashboardAnalytics).toHaveBeenCalledWith('rentals'));

    mockSelectedTenantId = 'tenant-B';
    propertyService.getAllProperties.mockResolvedValueOnce(listB);
    analyticsService.getDashboardAnalytics.mockResolvedValueOnce(kpisB);
    rerender(<ManagePropertiesPage section="location" />);
    await waitFor(() => expect(analyticsService.getDashboardAnalytics).toHaveBeenCalledTimes(2));
    expect(analyticsService.getDashboardAnalytics).toHaveBeenLastCalledWith('rentals');
  });
});

describe('ManagePropertiesPage — platform view + error/empty isolation', () => {
  test('FE-ISO-13 · FE-ISO-14: platform selection purges state without tenant fetches', async () => {
    propertyService.getAllProperties.mockResolvedValueOnce(listA);
    analyticsService.getDashboardAnalytics.mockResolvedValueOnce(kpisA);
    const { rerender } = render(<ManagePropertiesPage section="vente" />);
    await waitFor(() => expect(analyticsService.getDashboardAnalytics).toHaveBeenCalledTimes(1));

    // Vue plateforme (selectedTenantId=null)
    mockSelectedTenantId = null;
    propertyService.getAllProperties.mockResolvedValueOnce([...listA, ...listB]);
    analyticsService.getDashboardAnalytics.mockResolvedValueOnce({ kpis: { active: 6, published: 4 } });
    rerender(<ManagePropertiesPage section="vente" />);
    expect(analyticsService.getDashboardAnalytics).toHaveBeenCalledTimes(1);
    expect(propertyService.getAllProperties).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Bien Altitude')).not.toBeInTheDocument();
  });

  test('FE-ISO-12 (error state): a switch to an empty tenant clears the previous KPIs before any response', async () => {
    propertyService.getAllProperties.mockResolvedValueOnce(listA);
    analyticsService.getDashboardAnalytics.mockResolvedValueOnce(kpisA);
    const { rerender } = render(<ManagePropertiesPage section="vente" />);
    await waitFor(() => expect(screen.getByText('Bien Altitude')).toBeInTheDocument());

    // Switch to B, hold both requests.
    mockSelectedTenantId = 'tenant-B';
    let resolveB;
    let resolveAnalyticsB;
    propertyService.getAllProperties.mockImplementationOnce(() => new Promise((r) => { resolveB = r; }));
    analyticsService.getDashboardAnalytics.mockImplementationOnce(() => new Promise((r) => { resolveAnalyticsB = r; }));
    rerender(<ManagePropertiesPage section="vente" />);
    // Pendant que B est en cours, la liste A doit avoir été purgée.
    await waitFor(() => expect(screen.queryByText('Bien Altitude')).not.toBeInTheDocument());

    // Resolve B empty
    await act(async () => { resolveB([]); resolveAnalyticsB({ kpis: {} }); });
    expect(screen.queryByText('Bien Altitude')).not.toBeInTheDocument();
  });
});

describe('FE-TENANT portfolio lifecycle', () => {
  const payload = (name, value) => ({ totalBiens: 1, valeurTotale: value, valeurParType: { [name]: value }, biensVacants: 1, biensOccupes: 0 });
  beforeEach(() => {
    propertyService.getAllProperties.mockResolvedValue([]);
    analyticsService.getDashboardAnalytics.mockResolvedValue({ kpis: {} });
  });
  test.each([null, 'location', 'vente', 'hebergement'])('FE-TENANT-02/03 platform sends no tenant request for %s', async (section) => {
    mockSelectedTenantId = null;
    render(<ManagePropertiesPage section={section} />);
    await act(async () => {});
    expect(propertyService.getAllProperties).not.toHaveBeenCalled();
    expect(getPortfolioDashboard).not.toHaveBeenCalled();
    expect(analyticsService.getDashboardAnalytics).not.toHaveBeenCalled();
    expect(screen.getByText('Sélectionnez un tenant à administrer')).toBeInTheDocument();
  });
  test('FE-TENANT-04/05/08 A values purge and B loads without page reload', async () => {
    getPortfolioDashboard.mockResolvedValueOnce(payload('TYPE-A', 100000));
    const { rerender } = render(<ManagePropertiesPage section="location" />);
    expect(await screen.findByText('TYPE-A')).toBeInTheDocument();
    let resolveB;
    getPortfolioDashboard.mockImplementationOnce(() => new Promise(r => { resolveB = r; }));
    mockSelectedTenantId = 'tenant-B';
    rerender(<ManagePropertiesPage section="location" />);
    expect(screen.queryByText('TYPE-A')).not.toBeInTheDocument();
    await waitFor(() => expect(getPortfolioDashboard).toHaveBeenCalledTimes(2));
    await act(async () => resolveB(payload('TYPE-B', 200000)));
    expect(screen.getByText('TYPE-B')).toBeInTheDocument();
  });
  test('FE-TENANT-06/07 late A cannot overwrite B; platform purges B', async () => {
    let resolveA;
    getPortfolioDashboard.mockImplementationOnce(() => new Promise(r => { resolveA = r; }));
    const { rerender } = render(<ManagePropertiesPage section="location" />);
    await waitFor(() => expect(getPortfolioDashboard).toHaveBeenCalledTimes(1));
    mockSelectedTenantId = 'tenant-B';
    getPortfolioDashboard.mockResolvedValueOnce(payload('TYPE-B', 200000));
    rerender(<ManagePropertiesPage section="location" />);
    expect(await screen.findByText('TYPE-B')).toBeInTheDocument();
    await act(async () => resolveA(payload('TYPE-A', 100000)));
    expect(screen.queryByText('TYPE-A')).not.toBeInTheDocument();
    expect(screen.getByText('TYPE-B')).toBeInTheDocument();
    mockSelectedTenantId = null;
    rerender(<ManagePropertiesPage section="location" />);
    expect(screen.queryByText('TYPE-B')).not.toBeInTheDocument();
    expect(getPortfolioDashboard).toHaveBeenCalledTimes(2);
  });
});
