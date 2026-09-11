// MESSAGING-PLATFORM-INBOX-AGGREGATION-1B — Vue plateforme vs tenant :
// recharge à chaque changement de contexte, error != empty, badge tenant en
// mode plateforme, aucune donnée stale ne persiste.

import { act, render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import StaffInboxPage from '../pages/dashboard/StaffInboxPage';
import * as conversationService from '../services/conversationService';

let mockSelectedTenantId = null;

vi.mock('../services/conversationService', () => ({
  getStaffInbox: vi.fn(),
  getConversationMessages: vi.fn().mockResolvedValue([]),
  sendStaffReply: vi.fn(),
  sendStaffReplyWithAttachments: vi.fn(),
  markConversationAsRead: vi.fn().mockResolvedValue(),
  openConversationAttachment: vi.fn(),
}));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { _id: 'staff-1', id: 'staff-1', role: 'Admin', name: 'Staff' } }),
}));
vi.mock('../context/PlatformTenantRuntimeContext', () => ({
  usePlatformTenantRuntime: () => ({
    selectedTenantId: mockSelectedTenantId,
    tenants: [
      { _id: 'tenant-mila',     name: 'Mila Events' },
      { _id: 'tenant-altitude', name: 'Altitude Vision' },
    ],
  }),
}));
vi.mock('socket.io-client', () => ({ io: () => ({ on: () => {}, disconnect: () => {} }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../components/navigation/BackButton', () => ({ default: () => null }));

const conv = (id, tenantId, lastMessage) => ({
  _id: id,
  participants: [{ _id: 'client-1', name: 'huinlogistics Boss', role: 'Proprietaire' }],
  relatedProperty: null,
  tenant: tenantId,
  isStaffInbox: true,
  lastMessage,
  updatedAt: new Date().toISOString(),
  unreadCount: 0,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockSelectedTenantId = null;
});

describe('StaffInboxPage — reactivity + error state + tenant badge', () => {
  test('WEB-MSG-B-04 · WEB-MSG-B-10: platform scope → fetch, chaque ligne affiche son tenant', async () => {
    mockSelectedTenantId = null;
    conversationService.getStaffInbox.mockResolvedValueOnce([
      conv('c-mila',     'tenant-mila',     'Bonjour Mila'),
      conv('c-altitude', 'tenant-altitude', 'Ping Altitude'),
    ]);
    render(<StaffInboxPage />);
    await waitFor(() => expect(conversationService.getStaffInbox).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Bonjour Mila')).toBeInTheDocument();
    expect(screen.getByText('Ping Altitude')).toBeInTheDocument();
    const badges = screen.getAllByTestId('conv-tenant-badge').map((el) => el.textContent);
    expect(badges).toEqual(expect.arrayContaining(['Mila Events', 'Altitude Vision']));
  });

  test('WEB-MSG-B-02 · WEB-MSG-B-05: changement de contexte tenant Mila → refetch', async () => {
    mockSelectedTenantId = null;
    conversationService.getStaffInbox.mockResolvedValueOnce([]);
    const { rerender } = render(<StaffInboxPage />);
    await waitFor(() => expect(conversationService.getStaffInbox).toHaveBeenCalledTimes(1));

    mockSelectedTenantId = 'tenant-mila';
    conversationService.getStaffInbox.mockResolvedValueOnce([conv('c-mila', 'tenant-mila', 'Mila only')]);
    rerender(<StaffInboxPage />);
    await waitFor(() => expect(conversationService.getStaffInbox).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Mila only')).toBeInTheDocument();
  });

  test('WEB-MSG-B-11: mode tenant sélectionné → pas de badge redondant', async () => {
    mockSelectedTenantId = 'tenant-mila';
    conversationService.getStaffInbox.mockResolvedValueOnce([conv('c-mila', 'tenant-mila', 'Mila one')]);
    render(<StaffInboxPage />);
    await waitFor(() => expect(conversationService.getStaffInbox).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Mila one')).toBeInTheDocument();
    expect(screen.queryAllByTestId('conv-tenant-badge')).toHaveLength(0);
  });

  test('WEB-MSG-B-07: 403 → état d\'erreur (pas empty), bouton "Réessayer"', async () => {
    mockSelectedTenantId = null;
    conversationService.getStaffInbox.mockRejectedValueOnce(Object.assign(new Error('forbidden'), { response: { status: 403 } }));
    render(<StaffInboxPage />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    // Le texte apparaît à la fois dans le panel d'erreur ET dans le toast :
    // la présence dans le rôle alert suffit à prouver l'état d'erreur.
    expect(screen.getByRole('alert')).toHaveTextContent('Impossible de charger les conversations.');
    expect(screen.getByRole('alert')).toHaveTextContent('HTTP 403');
    expect(screen.queryByText('Aucune demande client')).not.toBeInTheDocument();
    // Retry
    conversationService.getStaffInbox.mockResolvedValueOnce([]);
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => expect(screen.getByText('Aucune demande client')).toBeInTheDocument());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('WEB-MSG-B-06: 200 [] → empty state distinct de l\'erreur', async () => {
    mockSelectedTenantId = null;
    conversationService.getStaffInbox.mockResolvedValueOnce([]);
    render(<StaffInboxPage />);
    await waitFor(() => expect(screen.getByText('Aucune demande client')).toBeInTheDocument());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('WEB-MSG-B-13: le compteur reflète le scope courant', async () => {
    mockSelectedTenantId = null;
    conversationService.getStaffInbox.mockResolvedValueOnce([
      conv('c1', 'tenant-mila', 'a'), conv('c2', 'tenant-altitude', 'b'), conv('c3', 'tenant-mila', 'c'),
    ]);
    render(<StaffInboxPage />);
    expect(await screen.findByText('3 conversations')).toBeInTheDocument();
  });

  test('WEB-MSG-B-16: réponse stale (ancien scope) est ignorée après changement de contexte', async () => {
    mockSelectedTenantId = null;
    let resolveFirst;
    conversationService.getStaffInbox
      .mockImplementationOnce(() => new Promise((r) => { resolveFirst = r; })) // scope 1 : jamais résolu jusqu'au switch
      .mockResolvedValueOnce([conv('c-mila', 'tenant-mila', 'Mila fresh')]);
    const { rerender } = render(<StaffInboxPage />);
    await waitFor(() => expect(conversationService.getStaffInbox).toHaveBeenCalledTimes(1));

    // Basculer vers Mila AVANT que la première requête ne résolve.
    mockSelectedTenantId = 'tenant-mila';
    rerender(<StaffInboxPage />);
    await waitFor(() => expect(conversationService.getStaffInbox).toHaveBeenCalledTimes(2));

    // Résoudre la 1re requête avec des conversations « anciennes ».
    await act(async () => { resolveFirst([conv('c-stale', 'tenant-altitude', 'Stale data')]); });

    // La liste finale doit être celle de Mila, pas la réponse tardive.
    expect(await screen.findByText('Mila fresh')).toBeInTheDocument();
    expect(screen.queryByText('Stale data')).not.toBeInTheDocument();
  });

  test('WEB-MSG-B-12: conversation.tenant null → libellé "Support général"', async () => {
    mockSelectedTenantId = null;
    conversationService.getStaffInbox.mockResolvedValueOnce([conv('c-null', null, 'Generique')]);
    render(<StaffInboxPage />);
    await waitFor(() => expect(screen.getByText('Generique')).toBeInTheDocument());
    expect(screen.getByTestId('conv-tenant-badge').textContent).toBe('Support général');
  });
});
