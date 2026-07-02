'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getNotifications,
  getUnreadCount,
  markRead   as apiMarkRead,
  markAllRead as apiMarkAllRead,
} from '../services/notificationService';

const POLL_MS = 30_000;

export function useNotifications(isAuthenticated = false) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [loading,       setLoading]       = useState(false);
  const pollRef = useRef(null);

  const fetchCount = useCallback(async () => {
    if (!isAuthenticated) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    try { setUnreadCount(await getUnreadCount()); } catch { /* silencieux */ }
  }, [isAuthenticated]);

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const data = await getNotifications(1, 'all');
      const list = data?.notifications || [];
      setNotifications(list);
      setUnreadCount(data?.unreadCount ?? 0);
    } catch { /* silencieux */ }
    finally { setLoading(false); }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      setNotifications([]);
      return;
    }
    fetchCount();
    pollRef.current = setInterval(fetchCount, POLL_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchCount();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(pollRef.current);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [isAuthenticated, fetchCount]);

  const markRead = useCallback(async (id) => {
    setNotifications((prev) => prev.map((n) => n._id === id ? { ...n, read: true } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
    apiMarkRead(id).catch(() => {});
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    apiMarkAllRead().catch(() => {});
  }, []);

  return { notifications, unreadCount, loading, fetchNotifications, markRead, markAllRead };
}
