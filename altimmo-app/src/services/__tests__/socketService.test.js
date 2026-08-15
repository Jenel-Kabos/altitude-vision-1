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
jest.mock('../api', () => ({ getToken: jest.fn(), getValidatedPlatformTenant: jest.fn(() => null) }));

import { getToken, getValidatedPlatformTenant } from '../api';
import {
  connectSocket,
  disconnectSocket,
  getSocket,
  getSocketDiagnostics,
  joinConversation,
  joinHotelRoom,
  leaveConversation,
  leaveHotelRoom,
} from '../socketService';

describe('socketService', () => {
  beforeEach(() => {
    disconnectSocket();
    jest.clearAllMocks();
    mockSocket.connected = true;
    getValidatedPlatformTenant.mockReturnValue(null);
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

  test('inclut le tenant validé dans le payload auth de connexion (jamais si aucun tenant validé)', async () => {
    getToken.mockResolvedValue('test-token');
    getValidatedPlatformTenant.mockReturnValue('tenant-a');
    await connectSocket();
    expect(mockIo.mock.calls[0][1].auth).toEqual({ token: 'test-token', platformTenantId: 'tenant-a' });
  });

  test("n'inclut aucun platformTenantId quand aucun tenant n'est validé", async () => {
    getToken.mockResolvedValue('test-token');
    getValidatedPlatformTenant.mockReturnValue(null);
    await connectSocket();
    expect(mockIo.mock.calls[0][1].auth).toEqual({ token: 'test-token' });
  });

  test('rafraîchit token ET tenant sur reconnect_attempt', async () => {
    getToken.mockResolvedValue('test-token');
    getValidatedPlatformTenant.mockReturnValue('tenant-a');
    await connectSocket();
    const reconnectHandler = mockManager.on.mock.calls.find(([event]) => event === 'reconnect_attempt')[1];

    getToken.mockResolvedValue('fresh-token');
    getValidatedPlatformTenant.mockReturnValue('tenant-b');
    await reconnectHandler();
    expect(mockSocket.auth).toEqual({ token: 'fresh-token', platformTenantId: 'tenant-b' });
  });

  // SYNC-2A — préparé pour SYNC-2C/2D, contrat exact DASH-4
  // (server/socket.js `establishment:join`/`establishment:leave`,
  // acquittement `{ ok, hotelId }` / `{ ok: false, error }`). Aucun écran ne
  // consomme encore ces fonctions.
  describe('joinHotelRoom / leaveHotelRoom (contrat DASH-4, non consommé par un écran)', () => {
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
    const waitForEmit = async (event, id) => {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const call = mockSocket.emit.mock.calls.find(([e, p]) => e === event && p?.id === id);
        if (call) return call;
        await flush();
      }
      throw new Error(`emit("${event}", { id: "${id}" }) jamais observé`);
    };
    const emitWithAck = async (event, id, ack) => {
      const call = await waitForEmit(event, id);
      call[2](ack);
    };

    test('émet establishment:join avec { type: "hotel", id } et résout avec l’acquittement serveur', async () => {
      getToken.mockResolvedValue('test-token');
      const pending = joinHotelRoom('hotel-1');
      await emitWithAck('establishment:join', 'hotel-1', { ok: true, hotelId: 'hotel-1' });
      await expect(pending).resolves.toEqual({ ok: true, hotelId: 'hotel-1' });
    });

    test('un acquittement refusé ne fait jamais confiance au client — resolves avec ok:false', async () => {
      getToken.mockResolvedValue('test-token');
      const pending = joinHotelRoom('hotel-forbidden');
      await emitWithAck('establishment:join', 'hotel-forbidden', { ok: false, error: 'Accès refusé' });
      await expect(pending).resolves.toEqual({ ok: false, error: 'Accès refusé' });
    });

    test('rejoindre une nouvelle room hôtel quitte automatiquement la précédente', async () => {
      getToken.mockResolvedValue('test-token');
      const first = joinHotelRoom('hotel-1');
      await emitWithAck('establishment:join', 'hotel-1', { ok: true, hotelId: 'hotel-1' });
      await first;

      const second = joinHotelRoom('hotel-2');
      await emitWithAck('establishment:leave', 'hotel-1', { ok: true });
      await emitWithAck('establishment:join', 'hotel-2', { ok: true, hotelId: 'hotel-2' });
      await expect(second).resolves.toEqual({ ok: true, hotelId: 'hotel-2' });
    });

    test('leaveHotelRoom sans room active ne fait rien', async () => {
      const result = await leaveHotelRoom();
      expect(result).toEqual({ ok: false });
    });

    test('disconnectSocket réinitialise la room hôtel active', async () => {
      getToken.mockResolvedValue('test-token');
      const pending = joinHotelRoom('hotel-1');
      await emitWithAck('establishment:join', 'hotel-1', { ok: true, hotelId: 'hotel-1' });
      await pending;
      disconnectSocket();
      const result = await leaveHotelRoom('hotel-1');
      expect(result).toEqual({ ok: false });
    });
  });
});
