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
const MAX_POLL_MS = 240_000;

export function useNotifications(isAuthenticated = false) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState(null);
  const pollRef = useRef(null);
  const pollFailuresRef = useRef(0);
  const countRequestRef = useRef(false);
  const notificationsRef = useRef([]);

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  const fetchCount = useCallback(async () => {
    if (!isAuthenticated || countRequestRef.current) return null;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return null;
    countRequestRef.current = true;
    try {
      setUnreadCount(await getUnreadCount());
      setError(null);
      pollFailuresRef.current = 0;
      return true;
    } catch {
      setError('Impossible de charger le compteur de notifications.');
      pollFailuresRef.current += 1;
      return false;
    } finally {
      countRequestRef.current = false;
    }
  }, [isAuthenticated]);

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const data = await getNotifications(1, 'all');
      const list = data?.notifications || [];
      setNotifications(list);
      setUnreadCount(data?.unreadCount ?? 0);
      setError(null);
      return data;
    } catch {
      setError('Impossible de charger les notifications.');
      return null;
    }
    finally { setLoading(false); }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      setNotifications([]);
      setError(null);
      return;
    }
    let cancelled = false;
    const nextDelay = () => Math.min(POLL_MS * (2 ** pollFailuresRef.current), MAX_POLL_MS);
    const schedule = (delay) => {
      pollRef.current = setTimeout(async () => {
        await fetchCount();
        if (!cancelled) schedule(nextDelay());
      }, delay);
    };
    fetchCount().finally(() => {
      if (!cancelled) schedule(nextDelay());
    });
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchCount();
    };
    document.addEventListener('visibilitychange', onVisibility);
    const onNotificationsChanged = () => fetchCount();
    window.addEventListener('altitude:notifications:changed', onNotificationsChanged);
    return () => {
      cancelled = true;
      clearTimeout(pollRef.current);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('altitude:notifications:changed', onNotificationsChanged);
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

    const handleNotification = (notification) => {
      if (!notification?._id || notificationsRef.current.some((item) => item._id === notification._id)) return;
      setNotifications((prev) => [notification, ...prev]);
      if (!notification.read) setUnreadCount((c) => c + 1);
    };
    socket.on('notification', handleNotification);

    return () => {
      socket.off('notification', handleNotification);
      socket.disconnect();
    };
  }, [isAuthenticated]);

  const markRead = useCallback(async (id) => {
    const wasUnread = notificationsRef.current.some((notification) => notification._id === id && !notification.read);
    try {
      await apiMarkRead(id);
      setNotifications((prev) => prev.map((notification) =>
        notification._id === id ? { ...notification, read: true } : notification,
      ));
      if (wasUnread) setUnreadCount((count) => Math.max(0, count - 1));
      setError(null);
      window.dispatchEvent(new CustomEvent('altitude:notifications:changed'));
      return true;
    } catch {
      setError('Impossible de marquer cette notification comme lue.');
      return false;
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await apiMarkAllRead();
      setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })));
      setUnreadCount(0);
      setError(null);
      window.dispatchEvent(new CustomEvent('altitude:notifications:changed'));
      return true;
    } catch {
      setError('Impossible de marquer toutes les notifications comme lues.');
      return false;
    }
  }, []);

  return { notifications, unreadCount, loading, error, fetchNotifications, markRead, markAllRead };
}
