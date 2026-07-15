import { renderHook, act } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';

const { getUnreadCount } = vi.hoisted(() => ({ getUnreadCount: vi.fn() }));
vi.mock('../services/notificationService', () => ({
  getNotifications: vi.fn(), getUnreadCount,
  markRead: vi.fn(), markAllRead: vi.fn(),
}));
vi.mock('socket.io-client', () => ({ io: vi.fn(() => ({ on: vi.fn(), off: vi.fn(), disconnect: vi.fn() })) }));

import { useNotifications } from '../hooks/useNotifications';

describe('useNotifications polling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getUnreadCount.mockReset();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  });
  afterEach(() => vi.useRealTimers());

  test('keeps the count on network failure, backs off, then resets after success', async () => {
    getUnreadCount.mockResolvedValueOnce(4).mockRejectedValueOnce(new Error('ERR_NETWORK')).mockResolvedValueOnce(6);
    const { result, unmount } = renderHook(() => useNotifications(true));
    await act(async () => {});
    expect(result.current.unreadCount).toBe(4);
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(result.current.unreadCount).toBe(4);
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(result.current.unreadCount).toBe(6);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
