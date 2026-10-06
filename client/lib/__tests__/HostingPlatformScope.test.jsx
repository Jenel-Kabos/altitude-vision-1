import { act, render, screen, waitFor } from '@testing-library/react';
import ManageAccommodationsPage from '../pages/dashboard/ManageAccommodationsPage';
import ManageHotelsPage from '../pages/dashboard/ManageHotelsPage';
import { getAccommodationsAdmin } from '../services/accommodationService';
import { getHotelPortfolio } from '../services/hotelService';

let runtime;
vi.mock('../context/PlatformTenantRuntimeContext', () => ({ usePlatformTenantRuntime: () => runtime }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { role: 'Admin' }, canEdit: true }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next/link', () => ({ default: ({ children, href, ...props }) => <a href={href} {...props}>{children}</a> }));
vi.mock('next/image', () => ({ default: (props) => <img {...props} /> }));
vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../components/dashboard/AccommodationPropertyForm', () => ({ default: () => null }));
vi.mock('../components/dashboard/HotelPropertyForm', () => ({ default: () => null }));
vi.mock('../services/accommodationService', () => ({ getAccommodationsAdmin: vi.fn(), deactivateAccommodation: vi.fn() }));
vi.mock('../services/hotelService', () => ({ getHotelPortfolio: vi.fn(), deactivateHotel: vi.fn() }));
vi.mock('../services/dashboardAnalyticsService', () => ({ getDashboardAnalytics: vi.fn().mockResolvedValue({ kpis: {} }) }));

const scopeRuntime = (mode, tenantId = null, manage = true) => ({
  scope: { mode, tenantId, key: mode === 'tenant' ? `tenant:${tenantId}` : mode },
  can: (capability) => manage && capability.endsWith('.manage'),
});
const accommodation = (id, title) => ({ _id: id, accommodationType: 'villa_meublee', property: { _id: `p-${id}`, title, price: 1000 } });
const hotel = (id, name) => ({ _id: id, name, property: { title: name, images: [] }, operationalStats: {} });
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };

describe('PA-04C — Hosting Web explicit scope', () => {
  beforeEach(() => { vi.clearAllMocks(); runtime = scopeRuntime('platform'); });

  test('Vue plateforme transporte platformScoped:true et ne propose aucune création', async () => {
    getAccommodationsAdmin.mockResolvedValue({ accommodations: [accommodation('global', 'Global Accommodation')], total: 1 });
    getHotelPortfolio.mockResolvedValue({ hotels: [hotel('global', 'Global Hotel')], total: 1 });
    render(<><ManageAccommodationsPage /><ManageHotelsPage /></>);
    expect(await screen.findByText('Global Accommodation')).toBeInTheDocument();
    expect(await screen.findByText('Global Hotel')).toBeInTheDocument();
    expect(getAccommodationsAdmin).toHaveBeenCalledWith(expect.any(Object), { platformScoped: true });
    expect(getHotelPortfolio).toHaveBeenCalledWith(expect.any(Object), { platformScoped: true });
    expect(screen.queryByRole('button', { name: /Ajouter un hébergement/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Ajouter un établissement/ })).toBeNull();
  });

  test('UNRESOLVED ne déclenche aucune lecture administrative', async () => {
    runtime = scopeRuntime('unresolved');
    render(<><ManageAccommodationsPage /><ManageHotelsPage /></>);
    await act(async () => Promise.resolve());
    expect(getAccommodationsAdmin).not.toHaveBeenCalled();
    expect(getHotelPortfolio).not.toHaveBeenCalled();
  });

  test('Accommodation PLATFORM → Tenant B ignore la réponse plateforme tardive', async () => {
    const old = deferred();
    getAccommodationsAdmin.mockReturnValueOnce(old.promise);
    const view = render(<ManageAccommodationsPage />);
    await waitFor(() => expect(getAccommodationsAdmin).toHaveBeenCalledWith(expect.any(Object), { platformScoped: true }));
    runtime = scopeRuntime('tenant', 'tenant-b');
    getAccommodationsAdmin.mockResolvedValueOnce({ accommodations: [accommodation('b', 'Tenant B Accommodation')], total: 1 });
    view.rerender(<ManageAccommodationsPage />);
    expect(await screen.findByText('Tenant B Accommodation')).toBeInTheDocument();
    await act(async () => old.resolve({ accommodations: [accommodation('old', 'Old Platform Accommodation')], total: 1 }));
    expect(screen.queryByText('Old Platform Accommodation')).toBeNull();
  });

  test('Hotel Tenant A → PLATFORM ignore la réponse tenant tardive', async () => {
    runtime = scopeRuntime('tenant', 'tenant-a');
    const old = deferred();
    getHotelPortfolio.mockReturnValueOnce(old.promise);
    const view = render(<ManageHotelsPage />);
    await waitFor(() => expect(getHotelPortfolio).toHaveBeenCalledWith(expect.any(Object), { platformScoped: false }));
    runtime = scopeRuntime('platform');
    getHotelPortfolio.mockResolvedValueOnce({ hotels: [hotel('g', 'Platform Hotel')], total: 1 });
    view.rerender(<ManageHotelsPage />);
    expect(await screen.findByText('Platform Hotel')).toBeInTheDocument();
    await act(async () => old.resolve({ hotels: [hotel('a', 'Old Tenant Hotel')], total: 1 }));
    expect(screen.queryByText('Old Tenant Hotel')).toBeNull();
  });
});
