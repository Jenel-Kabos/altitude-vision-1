import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({ socket: null, io: vi.fn() }));
vi.mock('socket.io-client', () => ({ io: state.io }));
vi.mock('../context/PlatformTenantRuntimeContext', () => ({ usePlatformTenantRuntime: () => ({ selectedTenantId: 'tenant-a' }) }));

import useHotelRealtime from '../hooks/useHotelRealtime';

describe('useHotelRealtime', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'TEST DATA TOKEN');
    const listeners = new Map();
    state.socket = {
      on: vi.fn((event, callback) => listeners.set(event, callback)),
      off: vi.fn((event) => listeners.delete(event)), emit: vi.fn(), disconnect: vi.fn(), listeners,
    };
    state.io.mockReset().mockReturnValue(state.socket);
  });

  test('join, filtre hôtel, reconnexion et cleanup sont contextualisés', () => {
    const onUpdate = vi.fn();
    const { rerender, unmount } = renderHook(({ id }) => useHotelRealtime(id, onUpdate), { initialProps: { id: 'hotel-a' } });
    state.socket.listeners.get('connect')();
    expect(state.socket.emit).toHaveBeenCalledWith('establishment:join', { type: 'hotel', id: 'hotel-a' });
    state.socket.listeners.get('hospitality:updated')({ hotelId: 'hotel-b' });
    expect(onUpdate).not.toHaveBeenCalled();
    state.socket.listeners.get('hospitality:updated')({ hotelId: 'hotel-a', eventType: 'housekeeping.completed' });
    expect(onUpdate).toHaveBeenCalledOnce();

    rerender({ id: 'hotel-b' });
    expect(state.socket.emit).toHaveBeenCalledWith('establishment:leave', { type: 'hotel', id: 'hotel-a' });
    expect(state.socket.disconnect).toHaveBeenCalledOnce();
    unmount();
    expect(state.socket.off).toHaveBeenCalledWith('hospitality:updated', expect.any(Function));
  });
});
