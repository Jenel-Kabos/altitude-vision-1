const mockManager = {
  on: jest.fn(),
  off: jest.fn(),
  engine: { transport: { name: 'websocket' } },
};
const mockSocket = {
  connected: true,
  auth: {},
  io: mockManager,
  connect: jest.fn(),
  disconnect: jest.fn(),
  emit: jest.fn(),
  eventNames: jest.fn(() => ['new-message']),
  listeners: jest.fn(() => [jest.fn()]),
  removeAllListeners: jest.fn(),
};
const mockIo = jest.fn(() => mockSocket);

jest.mock('socket.io-client', () => ({ io: (...args) => mockIo(...args) }));
jest.mock('../api', () => ({ getToken: jest.fn() }));

import { getToken } from '../api';
import {
  connectSocket,
  disconnectSocket,
  getSocket,
  getSocketDiagnostics,
  joinConversation,
  leaveConversation,
} from '../socketService';

describe('socketService', () => {
  beforeEach(() => {
    disconnectSocket();
    jest.clearAllMocks();
    mockSocket.connected = true;
  });

  test('ne crée pas de socket sans token', async () => {
    getToken.mockResolvedValue(null);
    await expect(connectSocket()).resolves.toBeNull();
    expect(mockIo).not.toHaveBeenCalled();
  });

  test('crée une seule socket authentifiée par session', async () => {
    getToken.mockResolvedValue('test-token');
    const first = await connectSocket();
    const second = await connectSocket();
    expect(first).toBe(second);
    expect(mockIo).toHaveBeenCalledTimes(1);
    expect(mockIo.mock.calls[0][1].auth).toEqual({ token: 'test-token' });
    expect(mockManager.on).toHaveBeenCalledTimes(1);
  });

  test('remplace la room active et déduplique une entrée identique', async () => {
    getToken.mockResolvedValue('test-token');
    await joinConversation('conversation-a');
    await joinConversation('conversation-a');
    await joinConversation('conversation-b');
    expect(mockSocket.emit.mock.calls).toEqual([
      ['join-room', 'conversation-a'],
      ['leave-room', 'conversation-a'],
      ['join-room', 'conversation-b'],
    ]);
  });

  test('quitte la room puis nettoie socket et reconnexion', async () => {
    getToken.mockResolvedValue('test-token');
    await joinConversation('conversation-a');
    leaveConversation();
    disconnectSocket();
    expect(mockSocket.emit).toHaveBeenCalledWith('leave-room', 'conversation-a');
    expect(mockManager.off).toHaveBeenCalledWith('reconnect_attempt', expect.any(Function));
    expect(mockSocket.removeAllListeners).toHaveBeenCalled();
    expect(mockSocket.disconnect).toHaveBeenCalled();
    expect(getSocket()).toBeNull();
  });

  test('expose uniquement des diagnostics techniques en développement', async () => {
    getToken.mockResolvedValue('test-token');
    await connectSocket();
    expect(getSocketDiagnostics()).toEqual({
      connected: true,
      listenerCount: 1,
      transport: 'websocket',
    });
  });
});
