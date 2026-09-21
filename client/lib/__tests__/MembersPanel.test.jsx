// USER-TENANT-MEMBERSHIP-ARCHITECTURE-1E — MEMUI harness. Toutes les
// mutations passent par /api/members (tenantMemberService). Aucune route
// /users/* n'a le droit d'être appelée depuis cet écran.

import { act, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import userEvent from '@testing-library/user-event';
import MembersPanel from '../pages/dashboard/MembersPanel';
import * as memberSvc from '../services/tenantMemberService';
import * as legacyUserSvc from '../services/userService';

let mockSelectedTenantId = 'tenant-A';
let mockTenants = [
  { _id: 'tenant-A', displayName: 'Mila Events' },
  { _id: 'tenant-B', displayName: 'Altimmo' },
];

vi.mock('../services/tenantMemberService', () => ({
  listMembers: vi.fn(),
  searchGlobalUserByEmail: vi.fn(),
  addMember: vi.fn(),
  changeMemberRole: vi.fn(),
  suspendMember: vi.fn(),
  reactivateMember: vi.fn(),
  removeMember: vi.fn(),
}));
vi.mock('../services/userService', () => ({
  getAllUsers: vi.fn(),
  updateUserRole: vi.fn(),
  createUserByAdmin: vi.fn(),
  deleteAdminUser: vi.fn(),
}));
vi.mock('../context/PlatformTenantRuntimeContext', () => ({
  usePlatformTenantRuntime: () => ({ selectedTenantId: mockSelectedTenantId, tenants: mockTenants }),
}));

const memberActive = (over = {}) => ({
  membershipId: 'm-1',
  user: { id: 'u-1', name: 'Alice Nkomo', email: 'alice@ex.io', avatar: null },
  businessRole: 'Admin', roleInUnit: 'admin', status: 'active', joinedAt: null,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockSelectedTenantId = 'tenant-A';
  mockTenants = [
    { _id: 'tenant-A', displayName: 'Mila Events' },
    { _id: 'tenant-B', displayName: 'Altimmo' },
  ];
});

describe('MEMUI — table source & counters', () => {
  test('MEMUI-01: GET /api/members populates the table', async () => {
    memberSvc.listMembers.mockResolvedValueOnce([memberActive(), memberActive({ membershipId: 'm-2', user: { name: 'Bob', email: 'b@x.io' }, businessRole: 'Collaborateur' })]);
    render(<MembersPanel />);
    await waitFor(() => expect(screen.getByText('Alice Nkomo')).toBeInTheDocument());
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(memberSvc.listMembers).toHaveBeenCalledTimes(1);
  });

  test('MEMUI-02: external Proprietaire absent — not returned by /api/members', async () => {
    // /api/members ne retourne que des OrgMembership tenant. Un Proprietaire
    // global sans membership n'apparaît jamais.
    memberSvc.listMembers.mockResolvedValueOnce([memberActive()]);
    render(<MembersPanel />);
    await waitFor(() => expect(screen.getByText('Alice Nkomo')).toBeInTheDocument());
    expect(screen.queryByText('Propriétaire')).not.toBeInTheDocument();
    expect(screen.queryByText('Propriétaires')).not.toBeInTheDocument(); // ancien filtre supprimé
  });

  test('MEMUI-20: businessRole labels rendered', async () => {
    memberSvc.listMembers.mockResolvedValueOnce([
      memberActive({ businessRole: 'GestionnaireImmobilier' }),
    ]);
    render(<MembersPanel />);
    await waitFor(() => expect(screen.getByText('Gestionnaire immobilier')).toBeInTheDocument());
  });

  test('MEMUI-21: suspended member status rendered', async () => {
    memberSvc.listMembers.mockResolvedValueOnce([memberActive({ status: 'suspended' })]);
    render(<MembersPanel />);
    await waitFor(() => expect(screen.getByText('Suspendu')).toBeInTheDocument());
  });
});

describe('MEMUI — add member workflow', () => {
  test('MEMUI-03 · MEMUI-04 · MEMUI-05: exact-email search, existing user shown, POST /api/members', async () => {
    memberSvc.listMembers.mockResolvedValueOnce([memberActive()]);
    memberSvc.searchGlobalUserByEmail.mockResolvedValueOnce({ found: true, user: { id: 'u-9', name: 'Cléo', email: 'cleo@ex.io' } });
    memberSvc.addMember.mockResolvedValueOnce(memberActive({ membershipId: 'm-9', user: { name: 'Cléo', email: 'cleo@ex.io' }, businessRole: 'Collaborateur' }));
    render(<MembersPanel />);
    await waitFor(() => expect(screen.getByText('Alice Nkomo')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /Ajouter un membre/i }));
    await userEvent.type(screen.getByLabelText('Email'), 'cleo@ex.io');
    await userEvent.click(screen.getByRole('button', { name: /Rechercher/i }));
    await waitFor(() => expect(memberSvc.searchGlobalUserByEmail).toHaveBeenCalledWith('cleo@ex.io'));
    await waitFor(() => expect(screen.getByText('Cléo')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /Ajouter à Mila Events/i }));
    await waitFor(() => expect(memberSvc.addMember).toHaveBeenCalledWith(expect.objectContaining({
      email: 'cleo@ex.io', businessRole: 'Collaborateur',
    })));
  });

  test('MEMUI-06: unknown email shows invitation-required state', async () => {
    memberSvc.listMembers.mockResolvedValueOnce([memberActive()]);
    memberSvc.searchGlobalUserByEmail.mockResolvedValueOnce({ found: false, user: null });
    render(<MembersPanel />);
    await waitFor(() => expect(screen.getByText('Alice Nkomo')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /Ajouter un membre/i }));
    await userEvent.type(screen.getByLabelText('Email'), 'ghost@ex.io');
    await userEvent.click(screen.getByRole('button', { name: /Rechercher/i }));
    await waitFor(() => expect(screen.getByText(/n'a pas encore de compte/i)).toBeInTheDocument());
    // CTA invitation présent mais désactivé.
    const invite = screen.getByRole('button', { name: /Inviter cette personne/i });
    expect(invite).toBeDisabled();
  });

  test('MEMUI-07: legacy createByAdmin is never called from MembersPanel', async () => {
    memberSvc.listMembers.mockResolvedValueOnce([memberActive()]);
    memberSvc.searchGlobalUserByEmail.mockResolvedValueOnce({ found: false, user: null });
    render(<MembersPanel />);
    await waitFor(() => expect(screen.getByText('Alice Nkomo')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /Ajouter un membre/i }));
    await userEvent.type(screen.getByLabelText('Email'), 'ghost@ex.io');
    await userEvent.click(screen.getByRole('button', { name: /Rechercher/i }));
    await waitFor(() => expect(screen.getByText(/n'a pas encore de compte/i)).toBeInTheDocument());
    expect(legacyUserSvc.createUserByAdmin).not.toHaveBeenCalled();
  });

  test('MEMUI-23: MEMBER_ALREADY_ACTIVE surfaces a business message', async () => {
    memberSvc.listMembers.mockResolvedValueOnce([memberActive()]);
    memberSvc.searchGlobalUserByEmail.mockResolvedValueOnce({ found: true, user: { id: 'u-9', name: 'Cléo', email: 'cleo@ex.io' } });
    memberSvc.addMember.mockRejectedValueOnce({ response: { status: 409, data: { code: 'MEMBER_ALREADY_ACTIVE' } } });
    render(<MembersPanel />);
    await waitFor(() => expect(screen.getByText('Alice Nkomo')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /Ajouter un membre/i }));
    await userEvent.type(screen.getByLabelText('Email'), 'cleo@ex.io');
    await userEvent.click(screen.getByRole('button', { name: /Rechercher/i }));
    await waitFor(() => expect(screen.getByText('Cléo')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /Ajouter à Mila Events/i }));
    await waitFor(() => expect(screen.getByText(/déjà membre/i)).toBeInTheDocument());
  });
});

describe('MEMUI — mutations use canonical endpoints', () => {
  test('MEMUI-08 · MEMUI-09: role change uses membershipId, legacy User role never called', async () => {
    memberSvc.listMembers.mockResolvedValueOnce([memberActive({ businessRole: 'Collaborateur' })]);
    memberSvc.changeMemberRole.mockResolvedValueOnce(memberActive({ businessRole: 'Admin' }));
    render(<MembersPanel />);
    await waitFor(() => expect(screen.getByText('Alice Nkomo')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /Modifier le rôle/i }));
    // The role picker button wraps a label span. Click via the label text's
    // closest button (there are role labels in filter tabs too, but they are
    // not in the picker's parent modal container).
    const adminLabels = screen.getAllByText('Admin');
    const pickerAdmin = adminLabels.map((el) => el.closest('button')).find((btn) => btn && /Autorité tenant/.test(btn.textContent));
    await userEvent.click(pickerAdmin);
    await userEvent.click(screen.getByRole('button', { name: /Confirmer/i }));
    await waitFor(() => expect(memberSvc.changeMemberRole).toHaveBeenCalledWith('m-1', 'Admin'));
    expect(legacyUserSvc.updateUserRole).not.toHaveBeenCalled();
  });

  test('MEMUI-10 · MEMUI-11: suspend uses membership endpoint, legacy User suspend not called', async () => {
    memberSvc.listMembers.mockResolvedValueOnce([memberActive({ businessRole: 'Collaborateur' })]);
    memberSvc.suspendMember.mockResolvedValueOnce(memberActive({ status: 'suspended', businessRole: 'Collaborateur' }));
    render(<MembersPanel />);
    await waitFor(() => expect(screen.getByText('Alice Nkomo')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /Suspendre/i }));
    await userEvent.click(screen.getByRole('button', { name: /Suspendre dans Mila Events/i }));
    await waitFor(() => expect(memberSvc.suspendMember).toHaveBeenCalledWith('m-1'));
  });

  test('MEMUI-12: reactivate membership', async () => {
    memberSvc.listMembers.mockResolvedValueOnce([memberActive({ status: 'suspended', businessRole: 'Collaborateur' })]);
    memberSvc.reactivateMember.mockResolvedValueOnce(memberActive({ status: 'active', businessRole: 'Collaborateur' }));
    render(<MembersPanel />);
    await waitFor(() => expect(screen.getByText('Alice Nkomo')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /Réactiver/i }));
    await waitFor(() => expect(memberSvc.reactivateMember).toHaveBeenCalledWith('m-1'));
  });

  test('MEMUI-22: reactivated member becomes active in table', async () => {
    memberSvc.listMembers.mockResolvedValueOnce([memberActive({ status: 'suspended', businessRole: 'Collaborateur' })]);
    memberSvc.reactivateMember.mockResolvedValueOnce(memberActive({ status: 'active', businessRole: 'Collaborateur' }));
    render(<MembersPanel />);
    await waitFor(() => expect(screen.getByText('Alice Nkomo')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /Réactiver/i }));
    await waitFor(() => expect(screen.getByText('Actif')).toBeInTheDocument());
  });

  test('MEMUI-13 · MEMUI-14: remove uses membership DELETE, global User DELETE never called', async () => {
    memberSvc.listMembers.mockResolvedValueOnce([memberActive({ businessRole: 'Collaborateur' })]);
    memberSvc.removeMember.mockResolvedValueOnce({});
    render(<MembersPanel />);
    await waitFor(() => expect(screen.getByText('Alice Nkomo')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /Retirer/i }));
    await userEvent.click(screen.getByRole('button', { name: /Retirer de Mila Events/i }));
    await waitFor(() => expect(memberSvc.removeMember).toHaveBeenCalledWith('m-1'));
    expect(legacyUserSvc.deleteAdminUser).not.toHaveBeenCalled();
  });

  test('MEMUI-15: LAST_TENANT_ADMIN produces a clear message', async () => {
    memberSvc.listMembers.mockResolvedValueOnce([memberActive()]);
    memberSvc.removeMember.mockRejectedValueOnce({ response: { status: 409, data: { code: 'LAST_TENANT_ADMIN' } } });
    render(<MembersPanel />);
    await waitFor(() => expect(screen.getByText('Alice Nkomo')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /Retirer/i }));
    await userEvent.click(screen.getByRole('button', { name: /Retirer de Mila Events/i }));
    await waitFor(() => expect(screen.getByText(/au moins un administrateur actif/i)).toBeInTheDocument());
  });

  test('MEMUI-24: 403 on mutation surfaces safe error, no legacy call falls back', async () => {
    memberSvc.listMembers.mockResolvedValueOnce([memberActive({ businessRole: 'Collaborateur' })]);
    memberSvc.suspendMember.mockRejectedValueOnce({ response: { status: 403, data: {} } });
    render(<MembersPanel />);
    await waitFor(() => expect(screen.getByText('Alice Nkomo')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /Suspendre/i }));
    await userEvent.click(screen.getByRole('button', { name: /Suspendre dans Mila Events/i }));
    await waitFor(() => expect(screen.getByText(/n'avez pas l'autorité/i)).toBeInTheDocument());
    // legacy /users/*/suspend not called.
    expect(legacyUserSvc.updateUserRole).not.toHaveBeenCalled();
    expect(legacyUserSvc.deleteAdminUser).not.toHaveBeenCalled();
  });
});

describe('MEMUI — tenant switch & stale response protection', () => {
  test('MEMUI-16 · MEMUI-17: A → B refetches and members A are cleared while B loads', async () => {
    memberSvc.listMembers.mockResolvedValueOnce([memberActive({ user: { name: 'Alice Nkomo', email: 'a@x.io' } })]);
    const { rerender } = render(<MembersPanel />);
    await waitFor(() => expect(screen.getByText('Alice Nkomo')).toBeInTheDocument());

    let resolveB;
    memberSvc.listMembers.mockImplementationOnce(() => new Promise((r) => { resolveB = r; }));
    mockSelectedTenantId = 'tenant-B';
    rerender(<MembersPanel />);
    // Pendant que B est en cours, Alice A doit avoir disparu (purge immédiate).
    await waitFor(() => expect(screen.queryByText('Alice Nkomo')).not.toBeInTheDocument());
    await act(async () => { resolveB([memberActive({ membershipId: 'm-b', user: { name: 'Béa', email: 'bea@x.io' } })]); });
    await waitFor(() => expect(screen.getByText('Béa')).toBeInTheDocument());
    expect(memberSvc.listMembers).toHaveBeenCalledTimes(2);
  });

  test('MEMUI-18: late Tenant A response cannot overwrite Tenant B state', async () => {
    let resolveA;
    memberSvc.listMembers.mockImplementationOnce(() => new Promise((r) => { resolveA = r; }));
    const { rerender } = render(<MembersPanel />);
    await waitFor(() => expect(memberSvc.listMembers).toHaveBeenCalledTimes(1));

    mockSelectedTenantId = 'tenant-B';
    memberSvc.listMembers.mockResolvedValueOnce([memberActive({ membershipId: 'm-b', user: { name: 'Béa', email: 'bea@x.io' } })]);
    rerender(<MembersPanel />);
    await waitFor(() => expect(screen.getByText('Béa')).toBeInTheDocument());

    // Late A response arrives — must be ignored.
    await act(async () => { resolveA([memberActive({ user: { name: 'Alice Nkomo', email: 'a@x.io' } })]); });
    expect(screen.queryByText('Alice Nkomo')).not.toBeInTheDocument();
    expect(screen.getByText('Béa')).toBeInTheDocument();
  });

  test('MEMUI-19: platform view (no tenant selected) asks for a tenant selection', async () => {
    mockSelectedTenantId = null;
    render(<MembersPanel />);
    expect(screen.getByText(/Sélectionnez une organisation/i)).toBeInTheDocument();
    expect(memberSvc.listMembers).not.toHaveBeenCalled();
  });
});
