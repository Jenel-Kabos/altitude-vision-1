// C2.9 (Users) — /dashboard/users change de source de données selon le contexte :
// Vue plateforme → registre User (listGlobalUsers), Vue tenant → OrgMembership
// (listMembers). Les deux sources ne se mélangent jamais.
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import UsersContextPanel from '../pages/dashboard/UsersContextPanel';
import { listGlobalUsers } from '../services/userService';
import { listMembers } from '../services/tenantMemberService';

let runtime;
const platform = () => ({
  scope: { mode: 'platform', tenantId: null, key: 'platform' }, selectedTenantId: null, tenantReady: true,
  tenants: [{ _id: 't-a', displayName: 'Tenant A' }, { _id: 't-b', displayName: 'Tenant B' }],
  isTenantAdmin: false, can: (c) => ['platform.users.read', 'platform.users.manage'].includes(c),
});
const tenant = (id) => ({ ...platform(), scope: { mode: 'tenant', tenantId: id, key: `tenant:${id}` }, selectedTenantId: id });

vi.mock('../context/PlatformTenantRuntimeContext', () => ({ usePlatformTenantRuntime: () => runtime }));
vi.mock('../services/userService', () => ({
  listGlobalUsers: vi.fn(), getGlobalUser: vi.fn(), suspendGlobalUser: vi.fn(), activateGlobalUser: vi.fn(), deleteGlobalUser: vi.fn(),
}));
vi.mock('../services/tenantMemberService', () => ({
  listMembers: vi.fn(), searchGlobalUserByEmail: vi.fn(), addMember: vi.fn(),
  changeMemberRole: vi.fn(), suspendMember: vi.fn(), reactivateMember: vi.fn(), removeMember: vi.fn(),
}));

const registry = {
  items: [{ _id: 'u-p', name: 'Paul Proprio', email: 'p@x.io', role: 'Proprietaire', status: 'Actif', isActive: true, tenantCount: 1,
    memberships: [{ _id: 'm-x', businessRole: 'Admin', status: 'active', tenant: { _id: 't-a', name: 'Tenant A' }, organization: { name: 'Tenant A' } }], platformOperator: null }],
  page: 1, limit: 25, total: 1, totalPages: 1, stats: { total: 1, active: 1, suspended: 0, withoutOrganization: 0 },
};
const member = (name, id) => ({ membershipId: id, user: { id, name, email: `${id}@x.io` }, businessRole: 'Collaborateur', status: 'active', joinedAt: null });

beforeEach(() => {
  vi.clearAllMocks();
  listGlobalUsers.mockResolvedValue(registry);
  listMembers.mockImplementation(async () => (runtime.selectedTenantId === 't-a' ? [member('Anna A', 'ua')] : [member('Bruno B', 'ub')]));
});

describe('C2.9 — UsersContextPanel', () => {
  test('C29CTX-01: Vue plateforme → registre User global, rôle plateforme, aucune lecture membres', async () => {
    runtime = platform();
    render(<UsersContextPanel />);
    expect(await screen.findByText('Paul Proprio')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Utilisateurs de la plateforme' })).toBeInTheDocument();
    expect(listGlobalUsers).toHaveBeenCalled();
    expect(listMembers).not.toHaveBeenCalled();
  });

  test('C29CTX-02: Vue tenant → membres OrgMembership du tenant, aucune lecture du registre', async () => {
    runtime = tenant('t-a');
    render(<UsersContextPanel />);
    expect(await screen.findByText('Anna A')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Membres — Tenant A/ })).toBeInTheDocument();
    expect(listGlobalUsers).not.toHaveBeenCalled();
  });

  test('C29CTX-03: plateforme → tenant A → tenant B → plateforme change réellement la source', async () => {
    runtime = platform();
    const { rerender } = render(<UsersContextPanel />);
    expect(await screen.findByText('Paul Proprio')).toBeInTheDocument();

    runtime = tenant('t-a');
    rerender(<UsersContextPanel />);
    expect(await screen.findByText('Anna A')).toBeInTheDocument();
    expect(screen.queryByText('Paul Proprio')).not.toBeInTheDocument();

    runtime = tenant('t-b');
    rerender(<UsersContextPanel />);
    expect(await screen.findByText('Bruno B')).toBeInTheDocument();
    expect(screen.queryByText('Anna A')).not.toBeInTheDocument();

    runtime = platform();
    rerender(<UsersContextPanel />);
    expect(await screen.findByText('Paul Proprio')).toBeInTheDocument();
    expect(screen.queryByText('Bruno B')).not.toBeInTheDocument();
    await waitFor(() => expect(listGlobalUsers).toHaveBeenCalledTimes(2));
    expect(listMembers).toHaveBeenCalledTimes(2);
  });

  test('C29CTX-04: contexte non résolu → aucun appel, message explicite', () => {
    runtime = { ...platform(), scope: { mode: 'unresolved', tenantId: null, key: 'unresolved' } };
    render(<UsersContextPanel />);
    expect(screen.getByText('Contexte requis')).toBeInTheDocument();
    expect(listGlobalUsers).not.toHaveBeenCalled();
    expect(listMembers).not.toHaveBeenCalled();
  });

  test('C29CTX-05: contexte en chargement → aucun appel', () => {
    runtime = { ...platform(), tenantReady: false };
    render(<UsersContextPanel />);
    expect(screen.getByRole('status')).toHaveTextContent('Chargement du contexte');
    expect(listGlobalUsers).not.toHaveBeenCalled();
  });
});
