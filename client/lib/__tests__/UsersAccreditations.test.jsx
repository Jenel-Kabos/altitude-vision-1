// PLATFORM-ACCREDITATIONS-1 — gestion des habilitations depuis l'onglet
// Utilisateurs (Vue plateforme). L'action n'apparaît qu'avec la capacité
// opérateur `platform.operators.manage` ; la fiche affiche exactement ce que
// renvoie le serveur (capacités actuelles, liste déléguable fermée, statut,
// interdiction d'auto-accréditation) et exige motif + confirmation.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UsersPanel from '../pages/dashboard/UsersPanel';
import AccreditationsDialog from '../pages/dashboard/AccreditationsDialog';
import { listGlobalUsers } from '../services/userService';
import { getDelegatedCapabilities, changeDelegatedCapability } from '../services/platformOperatorService';

let runtime = { can: () => false, selectedTenantId: null };

vi.mock('../context/PlatformTenantRuntimeContext', () => ({ usePlatformTenantRuntime: () => runtime }));
vi.mock('../services/userService', () => ({
  listGlobalUsers: vi.fn(), getGlobalUser: vi.fn(), suspendGlobalUser: vi.fn(), activateGlobalUser: vi.fn(), deleteGlobalUser: vi.fn(),
}));
vi.mock('../services/platformOperatorService', () => ({
  getDelegatedCapabilities: vi.fn(), changeDelegatedCapability: vi.fn(),
}));

const DELEGABLE = ['platform.support.read', 'platform.support.reply', 'platform.commercial.manage', 'platform.marketing.manage'];
const profile = (over = {}) => ({
  user: { _id: 'u-agent', name: 'Awa Agent', email: 'awa@example.test', role: 'Client', isActive: true, status: 'Actif' },
  operator: { status: 'active', capabilities: ['platform.support.read'] },
  delegableCapabilities: DELEGABLE,
  self: false,
  ...over,
});

const registry = {
  items: [{ _id: 'u-agent', name: 'Awa Agent', email: 'awa@example.test', role: 'Client', status: 'Actif', isActive: true, tenantCount: 0, memberships: [], platformOperator: null }],
  page: 1, limit: 25, total: 1, totalPages: 1, stats: { total: 1, active: 1, suspended: 0, withoutOrganization: 1 },
};

describe('Onglet Utilisateurs — action « Gérer les habilitations »', () => {
  beforeEach(() => { vi.clearAllMocks(); listGlobalUsers.mockResolvedValue(registry); });

  test('absente sans platform.operators.manage (même avec platform.users.manage)', async () => {
    runtime = { can: (cap) => ['platform.users.read', 'platform.users.manage'].includes(cap), selectedTenantId: null };
    render(<UsersPanel />);
    await screen.findByText('Awa Agent');
    expect(screen.queryByRole('button', { name: 'Gérer les habilitations de Awa Agent' })).not.toBeInTheDocument();
  });

  test('présente avec platform.operators.manage et ouvre la fiche d’habilitations', async () => {
    runtime = { can: (cap) => ['platform.users.read', 'platform.operators.manage'].includes(cap), selectedTenantId: null };
    getDelegatedCapabilities.mockResolvedValue(profile());
    render(<UsersPanel />);
    await userEvent.click(await screen.findByRole('button', { name: 'Gérer les habilitations de Awa Agent' }));
    const dialog = await screen.findByRole('dialog', { name: 'Habilitations de Awa Agent' });
    expect(getDelegatedCapabilities).toHaveBeenCalledWith('u-agent');
    expect(within(dialog).getByText('awa@example.test')).toBeInTheDocument();
  });
});

describe('AccreditationsDialog', () => {
  beforeEach(() => vi.clearAllMocks());

  test('affiche identité, statut, capacités actuelles et uniquement les capacités déléguables du serveur', async () => {
    getDelegatedCapabilities.mockResolvedValue(profile({ operator: { status: 'active', capabilities: ['platform.support.read', 'platform.finance.read'] } }));
    render(<AccreditationsDialog userId="u-agent" userName="Awa Agent" onClose={() => {}} />);
    const dialog = await screen.findByRole('dialog', { name: 'Habilitations de Awa Agent' });
    expect(within(dialog).getByText('Compte actif')).toBeInTheDocument();
    expect(within(dialog).getByText('Opérateur actif')).toBeInTheDocument();
    const current = within(dialog).getByRole('list', { name: 'Capacités actuelles' });
    expect(within(current).getByText('platform.finance.read')).toBeInTheDocument();
    const delegable = within(dialog).getByRole('list', { name: 'Capacités pouvant être attribuées' });
    expect(within(delegable).getAllByRole('listitem')).toHaveLength(4);
    expect(within(delegable).queryByText(/platform\.finance\.read/)).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Retirer Lecture de la boîte de support' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Accorder Réponse aux prospects' })).toBeInTheDocument();
  });

  test('confirmation avec motif obligatoire avant l’envoi, puis message de succès et rechargement', async () => {
    getDelegatedCapabilities
      .mockResolvedValueOnce(profile())
      .mockResolvedValueOnce(profile({ operator: { status: 'active', capabilities: ['platform.support.read', 'platform.support.reply'] } }));
    changeDelegatedCapability.mockResolvedValue({ status: 'active', capabilities: ['platform.support.read', 'platform.support.reply'] });
    render(<AccreditationsDialog userId="u-agent" userName="Awa Agent" onClose={() => {}} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Accorder Réponse aux prospects' }));
    expect(changeDelegatedCapability).not.toHaveBeenCalled();
    const confirm = screen.getByRole('button', { name: 'Confirmer' });
    expect(confirm).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Motif'), 'Agent support confirmé');
    await userEvent.click(confirm);
    await waitFor(() => expect(changeDelegatedCapability).toHaveBeenCalledWith('u-agent', {
      capability: 'platform.support.reply', action: 'grant', reason: 'Agent support confirmé',
    }));
    expect(await screen.findByRole('status')).toHaveTextContent('Habilitation accordée.');
    expect(await screen.findByRole('button', { name: 'Retirer Réponse aux prospects' })).toBeInTheDocument();
  });

  test('affiche le refus du serveur (administrateur critique protégé)', async () => {
    getDelegatedCapabilities.mockResolvedValue(profile({ operator: { status: 'active', capabilities: ['platform.commercial.manage', 'platform.operators.manage'] } }));
    changeDelegatedCapability.mockRejectedValue({ response: { data: { code: 'PLATFORM_CRITICAL_ADMIN_PROTECTED', message: 'Retrait refusé' } } });
    render(<AccreditationsDialog userId="u-agent" userName="Awa Agent" onClose={() => {}} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Retirer Gestion commerciale' }));
    await userEvent.type(screen.getByLabelText('Motif'), 'Test');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('administrateur critique');
  });

  test('aucune action sur son propre compte ni sur un opérateur suspendu', async () => {
    getDelegatedCapabilities.mockResolvedValueOnce(profile({ self: true }));
    const { unmount } = render(<AccreditationsDialog userId="u-agent" userName="Awa Agent" onClose={() => {}} />);
    expect(await screen.findByText('Vous ne pouvez pas modifier vos propres habilitations.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^(Accorder|Retirer) / })).not.toBeInTheDocument();
    unmount();

    getDelegatedCapabilities.mockResolvedValueOnce(profile({ operator: { status: 'suspended', capabilities: ['platform.support.read'] } }));
    render(<AccreditationsDialog userId="u-agent" userName="Awa Agent" onClose={() => {}} />);
    expect(await screen.findByText('Opérateur suspendu')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^(Accorder|Retirer) / })).not.toBeInTheDocument();
  });

  test('refus de lecture (403) affiché sans données', async () => {
    getDelegatedCapabilities.mockRejectedValue({ response: { status: 403, data: { message: 'Action refusée' } } });
    render(<AccreditationsDialog userId="u-agent" userName="Awa Agent" onClose={() => {}} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Action refusée');
    expect(screen.queryByRole('list', { name: 'Capacités pouvant être attribuées' })).not.toBeInTheDocument();
  });
});
