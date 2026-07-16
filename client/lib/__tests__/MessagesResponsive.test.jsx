import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MessagesPage from '../pages/MessagesPage';
import { getMyInbox, getConversationMessages, markConversationAsRead } from '../services/conversationService';

const replace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { _id: 'TEST-OWNER', id: 'TEST-OWNER', role: 'Proprietaire' },
    isInitialized: true,
  }),
}));

vi.mock('socket.io-client', () => ({ io: vi.fn(() => ({ on: vi.fn(), disconnect: vi.fn() })) }));

vi.mock('../services/conversationService', () => ({
  getMyInbox: vi.fn(), getConversationMessages: vi.fn(), markConversationAsRead: vi.fn(),
  sendStaffReply: vi.fn(), sendStaffReplyWithAttachments: vi.fn(), startStaffConversation: vi.fn(),
}));

describe('MessagesPage responsive — client et propriétaire', () => {
  beforeEach(() => {
    replace.mockReset();
    getMyInbox.mockReset();
    getConversationMessages.mockReset();
    markConversationAsRead.mockReset();
    localStorage.clear();
    getMyInbox.mockResolvedValue([{
      _id: 'TEST-CONVERSATION', lastMessage: 'MESSAGE TEST', unreadCount: 2,
      relatedProperty: { title: 'BIEN TEST' }, updatedAt: '2030-01-01T10:00:00.000Z',
    }]);
    getConversationMessages.mockResolvedValue([]);
    markConversationAsRead.mockResolvedValue({});
  });

  test('affiche la liste en premier puis le chat seul et revient à la liste', async () => {
    render(<MessagesPage />);
    expect(await screen.findByText('BIEN TEST')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retour aux conversations' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Équipe Altitude Vision/i }));
    expect(await screen.findByRole('button', { name: 'Retour aux conversations' })).toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith('/messages?conversationId=TEST-CONVERSATION', { scroll: false });
    await waitFor(() => expect(markConversationAsRead).toHaveBeenCalledWith('TEST-CONVERSATION'));

    fireEvent.click(screen.getByRole('button', { name: 'Retour aux conversations' }));
    expect(replace).toHaveBeenCalledWith('/messages', { scroll: false });
    expect(screen.getByText('BIEN TEST')).toBeInTheDocument();
  });

  test('ne crée aucune socket supplémentaire pendant liste, détail et retour', async () => {
    const { io } = await import('socket.io-client');
    localStorage.setItem('token', 'TEST-TOKEN');
    render(<MessagesPage />);
    await screen.findByText('BIEN TEST');
    fireEvent.click(screen.getByRole('button', { name: /Équipe Altitude Vision/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Retour aux conversations' }));
    expect(io).toHaveBeenCalledTimes(1);
  });
});
