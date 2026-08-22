import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import BackButton from '../components/navigation/BackButton';
import StaffInboxPage from '../pages/dashboard/StaffInboxPage';
import InternalMessagingPage from '../pages/dashboard/InternalMessagingPage';
import AdminDashboard from '../pages/dashboard/AdminDashboard';
import { getStaffInbox, getConversationMessages, markConversationAsRead } from '../services/conversationService';
import { getReceivedMessages, countUnread } from '../services/messageService';

const push = vi.fn();
const replace = vi.fn();
const back = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace, back }),
  usePathname: () => '/dashboard/conversations',
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { _id: 'TEST-STAFF', id: 'TEST-STAFF', role: 'Admin', name: 'STAFF TEST' },
    logout: vi.fn(), isCollaborateur: false, activeWrites: {}, timeLeft: () => 0, can: () => true,
  }),
}));

vi.mock('../hooks/useDashboardBadges', () => ({ useDashboardBadges: () => ({ badges: {} }) }));
vi.mock('../context/PlatformTenantRuntimeContext', () => ({
  usePlatformTenantRuntime: () => ({ tenantReady: true, tenantRequired: false, selectedTenantId: null }),
}));

vi.mock('socket.io-client', () => ({
  io: () => ({ on: vi.fn(), disconnect: vi.fn() }),
}));

vi.mock('../services/conversationService', () => ({
  getStaffInbox: vi.fn(),
  getConversationMessages: vi.fn(),
  sendStaffReply: vi.fn(),
  sendStaffReplyWithAttachments: vi.fn(),
  markConversationAsRead: vi.fn(),
}));

vi.mock('../services/messageService', () => ({
  sendInternalMail: vi.fn(), getReceivedMessages: vi.fn(), getSentMessages: vi.fn(),
  getUnreadMessages: vi.fn(), getStarredMessages: vi.fn(), getDraftMessages: vi.fn(),
  getTrashedMessages: vi.fn(), markAsRead: vi.fn(), addStar: vi.fn(), removeStar: vi.fn(),
  deleteMessage: vi.fn(), moveToTrash: vi.fn(), restoreFromTrash: vi.fn(),
  permanentlyDelete: vi.fn(), emptyTrash: vi.fn(), saveDraft: vi.fn(), updateDraft: vi.fn(),
  deleteDraft: vi.fn(), countUnread: vi.fn(),
}));

vi.mock('../services/userService', () => ({ getAllUsers: vi.fn().mockResolvedValue([]) }));

describe('Navigation responsive du dashboard', () => {
  beforeEach(() => {
    push.mockReset();
    replace.mockReset();
    back.mockReset();
    getStaffInbox.mockReset();
    getConversationMessages.mockReset();
    markConversationAsRead.mockReset();
    localStorage.clear();
    getReceivedMessages.mockReset();
    countUnread.mockReset();
  });

  test('BackButton privilégie le retour local', () => {
    const onBack = vi.fn();
    render(<BackButton onBack={onBack} fallbackHref="/dashboard/messages" />);
    fireEvent.click(screen.getByRole('button', { name: 'Retour' }));
    expect(onBack).toHaveBeenCalledOnce();
    expect(push).not.toHaveBeenCalled();
  });

  test('BackButton utilise son fallback sans historique interne', () => {
    render(<BackButton fallbackHref="/dashboard/messages" />);
    fireEvent.click(screen.getByRole('button', { name: 'Retour' }));
    expect(push).toHaveBeenCalledWith('/dashboard/messages');
  });

  test('les conversations passent de la liste au détail puis reviennent à la liste', async () => {
    getStaffInbox.mockResolvedValue([{
      _id: 'TEST-CONVERSATION',
      participants: [{ name: 'CLIENT TEST', role: 'Client' }],
      lastMessage: 'MESSAGE TEST',
      unreadCount: 1,
      updatedAt: '2030-01-01T10:00:00.000Z',
    }]);
    getConversationMessages.mockResolvedValue([]);
    markConversationAsRead.mockResolvedValue({});

    render(<StaffInboxPage />);
    expect(await screen.findByText('CLIENT TEST')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retour aux conversations' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /CLIENT TEST/i }));
    expect(await screen.findByRole('button', { name: 'Retour aux conversations' })).toBeInTheDocument();
    await waitFor(() => expect(getConversationMessages).toHaveBeenCalledWith('TEST-CONVERSATION'));

    fireEvent.click(screen.getByRole('button', { name: 'Retour aux conversations' }));
    expect(screen.queryByRole('button', { name: 'Retour aux conversations' })).not.toBeInTheDocument();
    expect(screen.getByText('CLIENT TEST')).toBeInTheDocument();
  });

  test('la messagerie interne suit dossiers, liste, détail puis les retours locaux', async () => {
    getReceivedMessages.mockResolvedValue([{
      _id: 'TEST-MAIL', subject: 'SUJET TEST', content: 'CONTENU TEST', isRead: true,
      sender: { name: 'EXPEDITEUR TEST', email: 'test@example.invalid' },
      receiver: { name: 'DESTINATAIRE TEST' }, createdAt: '2030-01-01T10:00:00.000Z',
    }]);
    countUnread.mockResolvedValue(0);

    render(<InternalMessagingPage />);
    // INBOX-PRO-2 — le rail de navigation desktop (icônes seules,
    // toujours dans le DOM, masqué en CSS sous lg:) coexiste désormais
    // avec l'écran mobile "dossiers" (rendu conditionnellement) : les deux
    // exposent un contrôle accessible "Boîte de réception". On scope donc
    // explicitement sur le landmark mobile ("Choisir un dossier") pour
    // tester la navigation mono-écran mobile, qui est l'objet réel de ce test.
    const mobileFolders = () => within(screen.getByRole('navigation', { name: 'Choisir un dossier' }));
    expect(mobileFolders().getByRole('button', { name: /Boîte de réception/i })).toBeInTheDocument();

    fireEvent.click(mobileFolders().getByRole('button', { name: /Boîte de réception/i }));
    expect(await screen.findByText('SUJET TEST')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retour aux dossiers' })).toBeInTheDocument();

    fireEvent.click(screen.getByText('SUJET TEST'));
    expect(await screen.findByRole('button', { name: 'Retour aux messages' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retour aux messages' }));
    expect(screen.getByRole('button', { name: 'Retour aux dossiers' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retour aux dossiers' }));
    expect(mobileFolders().getByRole('button', { name: /Boîte de réception/i })).toBeInTheDocument();
  });

  test('le menu mobile expose son état et se ferme avec Échap en restaurant le focus', async () => {
    render(<AdminDashboard><p>CONTENU DASHBOARD</p></AdminDashboard>);
    expect(screen.getAllByText('Messages clients')).toHaveLength(2);
    const trigger = screen.getByRole('button', { name: 'Ouvrir le menu' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Fermer le menu' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'));
    expect(trigger).toHaveFocus();
  });
});
