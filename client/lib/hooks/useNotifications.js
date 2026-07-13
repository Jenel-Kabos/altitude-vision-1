'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
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

  // Socket.IO temps réel — pousse les nouvelles notifications instantanément
  // (sinon jusqu'à 30s de latence via le polling ci-dessus). Le backend
  // (notificationService.js) émet l'event 'notification' avec l'objet
  // notification à plat — pas de wrapper { notification }.
  useEffect(() => {
    if (!isAuthenticated) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;

    const SOCKET_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace('/api', '') || 'http://localhost:5000';
    const socket = io(SOCKET_URL, { auth: { token } });

    socket.on('notification', (notification) => {
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((c) => c + 1);
    });

    return () => socket.disconnect();
  }, [isAuthenticated]);

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
