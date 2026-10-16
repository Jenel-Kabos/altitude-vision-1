// P0 SUPPORT-INBOX — /messages ne redirige vers la boîte de support
// (/dashboard/conversations) que les agents Altitude Vision détenant
// `platform.support.read`. Un membre d'organisation (Admin, Collaborateur,
// CommunityManager) reste sur sa messagerie directe : aucun rôle n'ouvre
// la boîte de support.
import { render, waitFor } from '@testing-library/react';

const replace = vi.fn();
const runtime = { capabilities: [] };
const authUser = { role: 'Admin' };

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { _id: 'TEST-USER', id: 'TEST-USER', role: authUser.role }, isInitialized: true }),
}));
vi.mock('../context/PlatformTenantRuntimeContext', () => ({
  usePlatformTenantRuntime: () => ({ can: (capability) => runtime.capabilities.includes(capability) }),
}));
vi.mock('socket.io-client', () => ({ io: vi.fn(() => ({ on: vi.fn(), disconnect: vi.fn() })) }));
vi.mock('../services/conversationService', () => ({
  getMyInbox: vi.fn().mockResolvedValue([]), getConversationMessages: vi.fn().mockResolvedValue([]),
  markConversationAsRead: vi.fn(), sendStaffReply: vi.fn(), sendStaffReplyWithAttachments: vi.fn(),
  startStaffConversation: vi.fn(),
}));

import MessagesPage from '../pages/MessagesPage';
import { getMyInbox } from '../services/conversationService';

describe('MessagesPage — redirection vers la boîte de support', () => {
  beforeEach(() => { replace.mockReset(); runtime.capabilities = []; });

  test.each(['Admin', 'Collaborateur', 'CommunityManager'])(
    'un membre d’organisation (%s) sans capacité support reste sur /messages',
    async (role) => {
      authUser.role = role;
      render(<MessagesPage />);
      await waitFor(() => expect(getMyInbox).toHaveBeenCalled());
      expect(replace).not.toHaveBeenCalledWith('/dashboard/conversations');
    },
  );

  test('un agent platform.support.read est redirigé vers la boîte de support', async () => {
    authUser.role = 'Client';
    runtime.capabilities = ['platform.support.read'];
    render(<MessagesPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard/conversations'));
  });
});
