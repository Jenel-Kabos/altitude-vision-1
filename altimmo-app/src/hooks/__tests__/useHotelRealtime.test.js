import { renderHook } from '@testing-library/react-native';

const mockSocket = { connected: true, on: jest.fn(), off: jest.fn() };
const mockConnectSocket = jest.fn(() => Promise.resolve(mockSocket));
const mockGetSocket = jest.fn(() => mockSocket);
const mockJoinHotelRoom = jest.fn(() => Promise.resolve({ ok: true }));
const mockLeaveHotelRoom = jest.fn(() => Promise.resolve({ ok: true }));

jest.mock('../../services/socketService', () => ({
  connectSocket: (...args) => mockConnectSocket(...args),
  getSocket: (...args) => mockGetSocket(...args),
  joinHotelRoom: (...args) => mockJoinHotelRoom(...args),
  leaveHotelRoom: (...args) => mockLeaveHotelRoom(...args),
}));

import useHotelRealtime from '../useHotelRealtime';

describe('useHotelRealtime', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSocket.connected = true;
    mockConnectSocket.mockResolvedValue(mockSocket);
  });

  test('sans hotelId : ne connecte rien', () => {
    renderHook(() => useHotelRealtime(null, jest.fn()));
    expect(mockConnectSocket).not.toHaveBeenCalled();
  });

  test('rejoint la room hôtel au montage et écoute hospitality:updated', async () => {
    renderHook(() => useHotelRealtime('hotel-1', jest.fn()));
    await flush();
    expect(mockJoinHotelRoom).toHaveBeenCalledWith('hotel-1');
    expect(mockSocket.on).toHaveBeenCalledWith('hospitality:updated', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
  });

  test('ignore un événement appartenant à un autre hôtel (mandat §39 cross-hotel)', async () => {
    const onUpdate = jest.fn();
    renderHook(() => useHotelRealtime('hotel-A', onUpdate));
    await flush();
    const handler = mockSocket.on.mock.calls.find(([event]) => event === 'hospitality:updated')[1];

    handler({ hotelId: 'hotel-B', eventType: 'housekeeping.completed' });
    expect(onUpdate).not.toHaveBeenCalled();

    handler({ hotelId: 'hotel-A', eventType: 'housekeeping.completed' });
    expect(onUpdate).toHaveBeenCalledWith({ hotelId: 'hotel-A', eventType: 'housekeeping.completed' });
  });

  test('se réabonne (rejoin) sur un connect ultérieur (reconnexion, mandat §38)', async () => {
    renderHook(() => useHotelRealtime('hotel-1', jest.fn()));
    await flush();
    mockJoinHotelRoom.mockClear();

    const connectHandler = mockSocket.on.mock.calls.find(([event]) => event === 'connect')[1];
    connectHandler();
    expect(mockJoinHotelRoom).toHaveBeenCalledWith('hotel-1');
  });

  test('quitte la room et retire les listeners au démontage', async () => {
    const { unmount } = renderHook(() => useHotelRealtime('hotel-1', jest.fn()));
    await flush();
    unmount();
    expect(mockLeaveHotelRoom).toHaveBeenCalledWith('hotel-1');
    expect(mockSocket.off).toHaveBeenCalledWith('hospitality:updated', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('connect', expect.any(Function));
  });

  test('un changement de hotelId (sans démontage) quitte A et rejoint B — switch hôtel via notification (mandat §51)', async () => {
    const { rerender } = renderHook(({ hotelId }) => useHotelRealtime(hotelId, jest.fn()), { initialProps: { hotelId: 'hotel-A' } });
    await flush();
    expect(mockJoinHotelRoom).toHaveBeenCalledWith('hotel-A');
    mockJoinHotelRoom.mockClear();

    rerender({ hotelId: 'hotel-B' });
    await flush();
    expect(mockLeaveHotelRoom).toHaveBeenCalledWith('hotel-A');
    expect(mockJoinHotelRoom).toHaveBeenCalledWith('hotel-B');
  });
});

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
