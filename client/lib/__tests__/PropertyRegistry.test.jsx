import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import PropertyRegistry from '../pages/dashboard/PropertyRegistry';
import { listPropertyRegistry, approvePropertyAdministration } from '../services/propertyService';

let runtime;
vi.mock('../context/PlatformTenantRuntimeContext', () => ({ usePlatformTenantRuntime: () => runtime }));
vi.mock('../services/propertyService', () => ({
  listPropertyRegistry: vi.fn(),
  approvePropertyAdministration: vi.fn(),
  rejectPropertyAdministration: vi.fn(),
}));

const row = (id, title, tenant = null) => ({
  _id: id, title, type: 'Villa', status: 'vente', statusAdmin: 'Validée', price: 250000,
  address: { city: 'Brazzaville', arrondissement: 'Centre' }, owner: { _id: `o-${id}`, name: `Propriétaire ${id}` }, tenant,
});
const A1 = row('a1', 'Villa Tenant A', { _id: 'tenant-a', name: 'Tenant A', status: 'active' });
const B1 = row('b1', 'Villa Tenant B', { _id: 'tenant-b', name: 'Tenant B', status: 'active' });
const U1 = row('u1', 'Maison indépendante');
const result = (items, overrides = {}) => ({ items, page: 1, limit: 20, total: items.length, totalPages: items.length ? 1 : 0, ...overrides });
const platformRuntime = (canRead = true) => ({
  tenantLoading: false, selectedTenantId: null, selectedTenant: null,
  scope: { mode: canRead === 'unresolved' ? 'unresolved' : 'platform', tenantId: null, key: canRead === 'unresolved' ? 'unresolved' : 'platform' },
  can: (capability) => canRead && capability === 'platform.properties.read',
  isTenantAdmin: false,
});
const tenantRuntime = (id, name) => ({
  tenantLoading: false, selectedTenantId: id, selectedTenant: { _id: id, name }, can: () => false,
  scope: { mode: 'tenant', tenantId: id, key: `tenant:${id}` }, isTenantAdmin: true,
});

describe('PropertyRegistry PA-03', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtime = platformRuntime();
    listPropertyRegistry.mockResolvedValue(result([A1, B1, U1]));
  });

  test('platform view requests platform scope and displays tenant A, tenant B and tenant:null', async () => {
    render(<PropertyRegistry />);
    expect(screen.getByRole('heading', { name: 'Biens de la plateforme' })).toBeInTheDocument();
    expect(await screen.findByText('Villa Tenant A')).toBeInTheDocument();
    expect(screen.getByText('Villa Tenant B')).toBeInTheDocument();
    expect(screen.getByText('Maison indépendante')).toBeInTheDocument();
    expect(screen.getByText('Aucune organisation')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Ouvrir le cockpit' })[0]).toHaveAttribute('href', '/dashboard/properties/a1');
    expect(listPropertyRegistry).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 20, sort: 'newest' }), { platformScoped: true });
  });

  test('platform view fails closed without the exact read capability and purges prior rows', async () => {
    const view = render(<PropertyRegistry />);
    await screen.findByText('Villa Tenant A');
    listPropertyRegistry.mockClear();
    runtime = platformRuntime(false);
    view.rerender(<PropertyRegistry />);
    expect(screen.getByText('Accès interdit')).toBeInTheDocument();
    expect(screen.queryByText('Villa Tenant A')).not.toBeInTheDocument();
    expect(listPropertyRegistry).not.toHaveBeenCalled();
  });

  test('unresolved scope sends no normal administration request', async () => {
    runtime = platformRuntime('unresolved');
    render(<PropertyRegistry />);
    expect(screen.getByText('Contexte d’administration requis')).toBeInTheDocument();
    expect(listPropertyRegistry).not.toHaveBeenCalled();
  });

  test.each([
    ['tenant-a', 'Tenant A', [A1], 'Villa Tenant B'],
    ['tenant-b', 'Tenant B', [B1], 'Villa Tenant A'],
  ])('tenant view %s renders only its server response', async (id, name, items, absent) => {
    runtime = tenantRuntime(id, name);
    listPropertyRegistry.mockResolvedValue(result(items));
    render(<PropertyRegistry />);
    expect(screen.getByRole('heading', { name: `Biens — ${name}` })).toBeInTheDocument();
    expect(await screen.findByText(items[0].title)).toBeInTheDocument();
    expect(screen.queryByText(absent)).not.toBeInTheDocument();
    expect(listPropertyRegistry).toHaveBeenCalledWith(expect.any(Object), { platformScoped: false });
  });

  test('Tenant A → platform purges rows and ignores the late Tenant A response', async () => {
    let resolveA;
    runtime = tenantRuntime('tenant-a', 'Tenant A');
    listPropertyRegistry.mockReturnValueOnce(new Promise((resolve) => { resolveA = resolve; }));
    const view = render(<PropertyRegistry />);
    await waitFor(() => expect(listPropertyRegistry).toHaveBeenCalledTimes(1));

    runtime = platformRuntime();
    listPropertyRegistry.mockResolvedValueOnce(result([A1, B1, U1]));
    view.rerender(<PropertyRegistry />);
    expect(screen.queryByText('Villa Tenant A')).not.toBeInTheDocument();
    expect(await screen.findByText('Maison indépendante')).toBeInTheDocument();
    await act(async () => resolveA(result([A1])));
    expect(screen.getByText('Maison indépendante')).toBeInTheDocument();
    expect(screen.getByText('Villa Tenant B')).toBeInTheDocument();
  });

  test('platform → Tenant B purges global rows and ignores the late platform response', async () => {
    let resolvePlatform;
    listPropertyRegistry.mockReturnValueOnce(new Promise((resolve) => { resolvePlatform = resolve; }));
    const view = render(<PropertyRegistry />);
    await waitFor(() => expect(listPropertyRegistry).toHaveBeenCalledTimes(1));
    runtime = tenantRuntime('tenant-b', 'Tenant B');
    listPropertyRegistry.mockResolvedValueOnce(result([B1]));
    view.rerender(<PropertyRegistry />);
    expect(await screen.findByText('Villa Tenant B')).toBeInTheDocument();
    await act(async () => resolvePlatform(result([A1, B1, U1])));
    expect(screen.queryByText('Maison indépendante')).not.toBeInTheDocument();
    expect(screen.queryByText('Villa Tenant A')).not.toBeInTheDocument();
  });

  test('renders loading, empty, no-result, error and API-forbidden states distinctly', async () => {
    let resolve;
    listPropertyRegistry.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const view = render(<PropertyRegistry />);
    expect(screen.getByText('Chargement des biens…')).toBeInTheDocument();
    await act(async () => resolve(result([])));
    expect(screen.getByText('Aucun bien enregistré')).toBeInTheDocument();

    listPropertyRegistry.mockResolvedValueOnce(result([]));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'introuvable' } });
    expect(await screen.findByText('Aucun bien ne correspond à votre recherche')).toBeInTheDocument();

    listPropertyRegistry.mockRejectedValueOnce(new Error('network'));
    fireEvent.click(screen.getByRole('button', { name: 'Actualiser' }));
    expect(await screen.findByText('Biens indisponibles')).toBeInTheDocument();

    listPropertyRegistry.mockRejectedValueOnce(Object.assign(new Error('forbidden'), { response: { status: 403 } }));
    fireEvent.click(screen.getByRole('button', { name: 'Actualiser' }));
    expect(await screen.findByText('Accès interdit')).toBeInTheDocument();
    view.unmount();
  });

  test('search, filters, sort and pagination are sent to the server', async () => {
    listPropertyRegistry.mockResolvedValue(result([A1], { total: 25, totalPages: 2 }));
    render(<PropertyRegistry />);
    await screen.findByText('Villa Tenant A');
    listPropertyRegistry.mockClear();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Villa' } });
    fireEvent.change(screen.getByLabelText('Offre'), { target: { value: 'vente' } });
    fireEvent.change(screen.getByLabelText('Type de bien'), { target: { value: 'Villa' } });
    fireEvent.change(screen.getByLabelText('Ville'), { target: { value: 'Brazzaville' } });
    fireEvent.change(screen.getByLabelText('Tri'), { target: { value: 'priceAsc' } });
    await waitFor(() => expect(listPropertyRegistry).toHaveBeenLastCalledWith(expect.objectContaining({
      page: 1, search: 'Villa', offerType: 'vente', propertyType: 'Villa', city: 'Brazzaville', sort: 'priceAsc',
    }), { platformScoped: true }), { timeout: 1500 });
    fireEvent.click(screen.getByRole('button', { name: 'Page suivante' }));
    await waitFor(() => expect(listPropertyRegistry).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }), { platformScoped: true }));
  });

  test('read capability alone exposes no mutation, while manage enables a proven moderation action', async () => {
    runtime = platformRuntime();
    const readOnlyView = render(<PropertyRegistry />);
    const card = await screen.findByTestId('property-registry-a1');
    expect(within(card).queryByRole('button', { name: 'Valider Villa Tenant A' })).not.toBeInTheDocument();
    readOnlyView.unmount();

    runtime = { ...platformRuntime(), can: (capability) => ['platform.properties.read', 'platform.properties.manage'].includes(capability) };
    approvePropertyAdministration.mockResolvedValue({});
    const managed = render(<PropertyRegistry />);
    const approve = await screen.findByRole('button', { name: 'Valider Villa Tenant A' });
    fireEvent.click(approve);
    await waitFor(() => expect(approvePropertyAdministration).toHaveBeenCalledWith('a1', { platformScoped: true }));
    managed.unmount();
  });

  test.each([
    ['vente', 'vente'],
    ['location', 'location'],
  ])('%s uses the same server registry contract with a fixed offer filter', async (section, offerType) => {
    render(<PropertyRegistry section={section} />);
    await screen.findByText('Villa Tenant A');
    expect(listPropertyRegistry).toHaveBeenCalledWith(
      expect.objectContaining({ offerType }),
      { platformScoped: true },
    );
  });
});
