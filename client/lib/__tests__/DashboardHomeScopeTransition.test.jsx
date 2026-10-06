// PLATFORM-ADMIN-04B1 — Dashboard Home : transitions PLATFORM ↔ TENANT.
// Une réponse démarrée dans un ancien contexte ne doit jamais écraser le
// nouveau ; un tenant sans données affiche des zéros (pas une erreur) ;
// UNRESOLVED n'émet aucune requête Home.
import { render, screen, waitFor, act } from '@testing-library/react';
import DashboardHome from '../pages/dashboard/DashboardHome';
import { getDashboardStats } from '../services/dashboardService';

let mockScope = { mode: 'platform', tenantId: null, key: 'platform' };
// Références stables, comme dans l'application (AuthContext / Next router) :
// des objets recréés à chaque rendu relanceraient artificiellement l'effet.
const mockRouter = { push: vi.fn(), replace: vi.fn() };
const mockUser = { _id: 'u1', role: 'Admin', name: 'Admin' };
vi.mock('next/navigation', () => ({ useRouter: () => mockRouter }));
vi.mock('next/link', () => ({ default: ({ children, href }) => <a href={href}>{children}</a> }));
vi.mock('recharts', () => {
  const Stub = ({ children }) => <div>{children}</div>;
  return { ResponsiveContainer: Stub, BarChart: Stub, Bar: Stub, XAxis: Stub, YAxis: Stub, CartesianGrid: Stub, Tooltip: Stub, Legend: Stub, PieChart: Stub, Pie: Stub, Cell: Stub, LineChart: Stub, Line: Stub, AreaChart: Stub, Area: Stub };
});
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: mockUser, loading: false }) }));
vi.mock('../context/PlatformTenantRuntimeContext', () => ({ usePlatformTenantRuntime: () => ({ scope: mockScope }) }));
vi.mock('../services/dashboardService', () => ({ getDashboardStats: vi.fn() }));
vi.mock('../services/quoteService', () => ({ getAllQuotes: vi.fn().mockResolvedValue([]) }));
vi.mock('../services/eventService', () => ({ getAllEvents: vi.fn().mockResolvedValue([]) }));
vi.mock('../services/gestionLocativeService', () => ({ getAlertesPaiements: vi.fn().mockResolvedValue(null) }));
vi.mock('../services/userService', () => ({ getAllUsers: vi.fn().mockResolvedValue([]) }));
vi.mock('../services/actionLogService', () => ({ getRecentActionLogs: vi.fn().mockResolvedValue([]) }));
vi.mock('../pages/dashboard/RoleDashboardOverview', () => ({ default: () => <div>role overview</div> }));

const statsPayload = (altimmo) => ({ stats: { Altimmo: altimmo, MilaEvents: 0, Altcom: 0 }, kpis: null, activity: null, performance: null, contratsActifs: 0 });
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
const altimmoValue = () => screen.getByText('Biens Altimmo').parentElement?.parentElement?.textContent || '';

describe('PA-04B1 — DashboardHome transitions', () => {
  beforeEach(() => { vi.clearAllMocks(); mockScope = { mode: 'platform', tenantId: null, key: 'platform' }; });

  test('PLATFORM → Tenant B rapide : la réponse plateforme tardive n’écrase jamais Tenant B', async () => {
    const platform = deferred();
    getDashboardStats.mockImplementation((scope) => (scope.mode === 'platform' ? platform.promise : Promise.resolve(statsPayload(7))));
    const view = render(<DashboardHome />);
    expect(getDashboardStats).toHaveBeenCalledWith(expect.objectContaining({ mode: 'platform' }));

    mockScope = { mode: 'tenant', tenantId: 'tenant-b', key: 'tenant:tenant-b' };
    view.rerender(<DashboardHome />);
    await waitFor(() => expect(altimmoValue()).toContain('7'));

    await act(async () => { platform.resolve(statsPayload(4242)); await platform.promise; });
    expect(altimmoValue()).toContain('7');
    expect(altimmoValue()).not.toContain('4242');
    expect(screen.queryByText('Erreur de chargement')).toBeNull();
  });

  test('Tenant A → Tenant B rapide : la réponse A tardive n’écrase jamais B', async () => {
    mockScope = { mode: 'tenant', tenantId: 'tenant-a', key: 'tenant:tenant-a' };
    const tenantA = deferred();
    getDashboardStats.mockImplementation((scope) => (scope.tenantId === 'tenant-a' ? tenantA.promise : Promise.resolve(statsPayload(3))));
    const view = render(<DashboardHome />);
    mockScope = { mode: 'tenant', tenantId: 'tenant-b', key: 'tenant:tenant-b' };
    view.rerender(<DashboardHome />);
    await waitFor(() => expect(altimmoValue()).toContain('3'));
    await act(async () => { tenantA.resolve(statsPayload(9999)); await tenantA.promise; });
    expect(altimmoValue()).not.toContain('9999');
  });

  test('Tenant B → PLATFORM : la vue plateforme affiche ses propres données', async () => {
    mockScope = { mode: 'tenant', tenantId: 'tenant-b', key: 'tenant:tenant-b' };
    getDashboardStats.mockImplementation((scope) => Promise.resolve(statsPayload(scope.mode === 'platform' ? 55 : 2)));
    const view = render(<DashboardHome />);
    await waitFor(() => expect(altimmoValue()).toContain('2'));
    mockScope = { mode: 'platform', tenantId: null, key: 'platform' };
    view.rerender(<DashboardHome />);
    await waitFor(() => expect(altimmoValue()).toContain('55'));
  });

  test('tenant sans données : zéros, aucun état d’erreur', async () => {
    mockScope = { mode: 'tenant', tenantId: 'tenant-empty', key: 'tenant:tenant-empty' };
    getDashboardStats.mockResolvedValue(statsPayload(0));
    render(<DashboardHome />);
    await waitFor(() => expect(getDashboardStats).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText('Biens Altimmo')).toBeTruthy());
    expect(screen.queryByText('Erreur de chargement')).toBeNull();
  });

  test('UNRESOLVED : aucune requête Home', async () => {
    mockScope = { mode: 'unresolved', tenantId: null, key: 'unresolved' };
    render(<DashboardHome />);
    await new Promise((r) => setTimeout(r, 20));
    expect(getDashboardStats).not.toHaveBeenCalled();
  });
});
