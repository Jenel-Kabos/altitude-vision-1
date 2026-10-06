import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UsersPanel from '../pages/dashboard/UsersPanel';
import {
  listGlobalUsers, getGlobalUser, suspendGlobalUser, deleteGlobalUser,
} from '../services/userService';

let runtime = { can: (capability) => capability === 'platform.users.read', selectedTenantId: null };

vi.mock('../context/PlatformTenantRuntimeContext', () => ({ usePlatformTenantRuntime: () => runtime }));
vi.mock('../services/userService', () => ({
  listGlobalUsers: vi.fn(),
  getGlobalUser: vi.fn(),
  suspendGlobalUser: vi.fn(),
  activateGlobalUser: vi.fn(),
  deleteGlobalUser: vi.fn(),
}));

const registry = (overrides = {}) => ({
  items: [
    {
      _id: 'u-none', name: 'Aline Sans Organisation', email: 'aline@example.test', phone: null,
      role: 'Proprietaire', status: 'Actif', isActive: true, tenantCount: 0, memberships: [], platformOperator: null,
    },
    {
      _id: 'u-multi', name: 'Marc Multi', email: 'marc@example.test', phone: '+242060000000',
      role: 'Client', status: 'Suspendu', isActive: false, tenantCount: 2,
      memberships: [
        { _id: 'm-a', businessRole: 'Admin', status: 'active', tenant: { _id: 't-a', name: 'Tenant A' }, organization: { name: 'Tenant A' } },
        { _id: 'm-b', businessRole: 'Collaborateur', status: 'active', tenant: { _id: 't-b', name: 'Tenant B' }, organization: { name: 'Tenant B' } },
      ],
      platformOperator: { status: 'active' },
    },
  ],
  page: 1, limit: 25, total: 2, totalPages: 1,
  stats: { total: 2, active: 1, suspended: 1, withoutOrganization: 1 },
  ...overrides,
});

describe('Global Users registry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    runtime = { can: (capability) => capability === 'platform.users.read', selectedTenantId: null };
    listGlobalUsers.mockResolvedValue(registry());
    getGlobalUser.mockResolvedValue(registry().items[1]);
  });

  test('renders loading placeholders then the global registry and real statistics', async () => {
    let resolve;
    listGlobalUsers.mockReturnValue(new Promise((done) => { resolve = done; }));
    render(<UsersPanel />);

    expect(screen.getByRole('heading', { name: 'Utilisateurs de la plateforme' })).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    resolve(registry());

    expect(await screen.findByText('Aline Sans Organisation')).toBeInTheDocument();
    expect(screen.getByText('Aucune organisation')).toBeInTheDocument();
    expect(screen.getByText('2', { selector: '[data-stat="total"]' })).toBeInTheDocument();
  });

  test('renders a multi-tenant suspended operator once and opens its detail', async () => {
    const user = userEvent.setup();
    render(<UsersPanel />);
    const row = await screen.findByTestId('global-user-u-multi');

    expect(screen.getAllByText('Marc Multi')).toHaveLength(1);
    expect(within(row).getByText('Tenant A')).toBeInTheDocument();
    expect(within(row).getByText('Tenant B')).toBeInTheDocument();
    expect(within(row).getByText('Suspendu')).toBeInTheDocument();
    expect(within(row).getByText('Opérateur actif')).toBeInTheDocument();

    await user.click(within(row).getByRole('button', { name: /voir marc multi/i }));
    expect(await screen.findByRole('dialog', { name: /fiche utilisateur/i })).toBeInTheDocument();
    expect(screen.getByText('Tenant A — Admin')).toBeInTheDocument();
    expect(screen.queryByText(/tokenVersion|passwordResetToken/i)).not.toBeInTheDocument();
  });

  test('distinguishes empty, no-result, error, and forbidden states', async () => {
    const view = render(<UsersPanel />);
    listGlobalUsers.mockResolvedValueOnce(registry({ items: [], total: 0, totalPages: 0, stats: { total: 0, active: 0, suspended: 0, withoutOrganization: 0 } }));
    fireEvent.click(screen.getByRole('button', { name: /actualiser/i }));
    expect(await screen.findByText('Aucun utilisateur enregistré')).toBeInTheDocument();

    listGlobalUsers.mockRejectedValueOnce(Object.assign(new Error('network'), { response: { status: 500 } }));
    fireEvent.click(screen.getByRole('button', { name: /actualiser/i }));
    expect(await screen.findByText('Utilisateurs indisponibles')).toBeInTheDocument();

    runtime = { can: () => false, selectedTenantId: null };
    view.rerender(<UsersPanel />);
    expect(screen.getByText('Accès interdit')).toBeInTheDocument();
  });

  test('debounces server search and sends filters, sort, and pagination without selectedTenantId', async () => {
    runtime = { can: (capability) => capability === 'platform.users.read', selectedTenantId: 'tenant-selected' };
    render(<UsersPanel />);
    await waitFor(() => expect(listGlobalUsers).toHaveBeenCalled());
    listGlobalUsers.mockClear();

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Marc' } });
    fireEvent.change(screen.getByLabelText('Statut'), { target: { value: 'Suspendu' } });
    fireEvent.change(screen.getByLabelText('Organisation'), { target: { value: 'with' } });
    fireEvent.change(screen.getByLabelText('Tri'), { target: { value: 'name' } });
    await new Promise((resolve) => setTimeout(resolve, 350));

    await waitFor(() => expect(listGlobalUsers).toHaveBeenLastCalledWith(expect.objectContaining({
      page: 1, search: 'Marc', status: 'Suspendu', organization: 'with', sort: 'name',
    })));
    expect(listGlobalUsers.mock.calls.at(-1)[0]).not.toHaveProperty('selectedTenantId');
    expect(listGlobalUsers.mock.calls.at(-1)[0]).not.toHaveProperty('tenantId', 'tenant-selected');
  });

  test('ignores a stale response from an older search', async () => {
    let resolveOld;
    listGlobalUsers
      .mockResolvedValueOnce(registry())
      .mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }))
      .mockResolvedValueOnce(registry({ items: [{ ...registry().items[0], _id: 'latest', name: 'Résultat récent' }] }));
    render(<UsersPanel />);
    await screen.findByText('Aline Sans Organisation');

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'ancien' } });
    await new Promise((resolve) => setTimeout(resolve, 350));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'récent' } });
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(await screen.findByText('Résultat récent')).toBeInTheDocument();

    resolveOld(registry({ items: [{ ...registry().items[0], _id: 'old', name: 'Résultat périmé' }] }));
    await waitFor(() => expect(screen.queryByText('Résultat périmé')).not.toBeInTheDocument());
  });

  test('read-only authority never receives lifecycle controls', async () => {
    render(<UsersPanel />);
    await screen.findByText('Aline Sans Organisation');
    expect(screen.queryByRole('button', { name: /suspendre|réactiver|supprimer/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/bannir|débannir/i)).not.toBeInTheDocument();
  });

  test('manage authority exposes supported actions behind explicit confirmations', async () => {
    const user = userEvent.setup();
    runtime = { can: (capability) => ['platform.users.read', 'platform.users.manage'].includes(capability), selectedTenantId: null };
    suspendGlobalUser.mockResolvedValue({});
    render(<UsersPanel />);
    const row = await screen.findByTestId('global-user-u-none');

    await user.click(within(row).getByRole('button', { name: /suspendre aline/i }));
    expect(suspendGlobalUser).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: /confirmer la suspension/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(suspendGlobalUser).not.toHaveBeenCalled();

    await user.click(within(row).getByRole('button', { name: /suspendre aline/i }));
    await user.click(screen.getByRole('button', { name: 'Confirmer la suspension' }));
    await waitFor(() => expect(suspendGlobalUser).toHaveBeenCalledWith('u-none'));
    expect(listGlobalUsers.mock.calls.length).toBeGreaterThan(1);
    expect(screen.queryByText(/bannir|débannir/i)).not.toBeInTheDocument();
  });

  test('deletion requires typing the target email and rolls back an empty last page', async () => {
    const user = userEvent.setup();
    runtime = { can: () => true, selectedTenantId: null };
    listGlobalUsers
      .mockResolvedValueOnce(registry({ items: [registry().items[0]], page: 2, total: 26, totalPages: 2 }))
      .mockResolvedValue(registry({ page: 1, total: 25, totalPages: 1 }));
    deleteGlobalUser.mockResolvedValue(undefined);
    render(<UsersPanel />);
    const row = await screen.findByTestId('global-user-u-none');

    await user.click(within(row).getByRole('button', { name: /supprimer aline/i }));
    expect(deleteGlobalUser).not.toHaveBeenCalled();
    const confirm = screen.getByRole('button', { name: 'Supprimer définitivement' });
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText('Confirmer avec l’email'), 'aline@example.test');
    await user.click(confirm);

    await waitFor(() => expect(deleteGlobalUser).toHaveBeenCalledWith('u-none'));
    await waitFor(() => expect(listGlobalUsers).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 })));
  });

  test.each([
    ['LAST_PLATFORM_OPERATOR', 'Le dernier opérateur plateforme viable doit rester actif.'],
    ['PLATFORM_OPERATOR_HARD_DELETE_REQUIRES_HUMAN_DECISION', 'Cette identité possède un historique opérateur et ne peut pas être supprimée physiquement.'],
    ['SELF_ACTION_FORBIDDEN', 'Vous ne pouvez pas appliquer cette action à votre propre compte.'],
  ])('shows a precise safe message for %s', async (code, message) => {
    const user = userEvent.setup();
    runtime = { can: () => true, selectedTenantId: null };
    suspendGlobalUser.mockRejectedValue({ response: { data: { code } } });
    render(<UsersPanel />);
    const row = await screen.findByTestId('global-user-u-none');
    await user.click(within(row).getByRole('button', { name: /suspendre aline/i }));
    await user.click(screen.getByRole('button', { name: 'Confirmer la suspension' }));
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: /confirmer la suspension/i })).toBeInTheDocument();
  });
  test('C2.9 — le tableau n’affiche que les organisations actives et le rôle plateforme', async () => {
    listGlobalUsers.mockResolvedValue(registry({
      items: [{
        _id: 'u-former', name: 'Ancien Membre', email: 'former@example.test', role: 'Proprietaire', status: 'Actif', isActive: true,
        tenantCount: 0, platformOperator: null,
        memberships: [{ _id: 'm-r', businessRole: 'Admin', status: 'revoked', tenant: { _id: 't-r', name: 'Tenant Révoqué' }, organization: { name: 'Tenant Révoqué' } }],
      }],
      total: 1, stats: { total: 1, active: 1, suspended: 0, withoutOrganization: 1 },
    }));
    render(<UsersPanel />);
    const row = (await screen.findByText('Ancien Membre')).closest('tr');
    expect(within(row).getByText('Aucune organisation')).toBeInTheDocument();
    expect(within(row).queryByText('Tenant Révoqué')).not.toBeInTheDocument();
    expect(within(row).queryByText('Admin')).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Compte \/ statut plateforme/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Organisation(s)' })).toBeInTheDocument();
  });
});
