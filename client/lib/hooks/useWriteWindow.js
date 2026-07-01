"use client";

import { useState, useCallback, useEffect, useRef } from 'react';

const WINDOW_MS   = 10 * 60 * 1000; // 10 minutes
const STORAGE_KEY = 'av_write_windows';

const load = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
};

const save = (data) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
};

const purge = (data) => {
  const now = Date.now();
  return Object.fromEntries(
    Object.entries(data).filter(([, ts]) => now - ts < WINDOW_MS)
  );
};

/**
 * useWriteWindow — gère la fenêtre d'écriture de 10 minutes pour les collaborateurs.
 *
 * API :
 *   registerWrite(resourceId)    — appeler après un POST réussi
 *   canModify(resourceId)        — true si dans les 10 min
 *   timeLeft(resourceId)         — secondes restantes (0 si expiré)
 *   activeWrites                 — { [resourceId]: timestamp } (windows actives)
 */
export const useWriteWindow = (isCollaborateur) => {
  const [windows, setWindows] = useState({});
  const tickRef = useRef(null);

  // Chargement initial depuis localStorage
  useEffect(() => {
    if (!isCollaborateur) return;
    const fresh = purge(load());
    setWindows(fresh);
    save(fresh);
  }, [isCollaborateur]);

  // Ticker — met à jour l'état toutes les secondes pour les countdowns
  useEffect(() => {
    if (!isCollaborateur) return;
    tickRef.current = setInterval(() => {
      setWindows(prev => {
        const fresh = purge(prev);
        if (Object.keys(fresh).length !== Object.keys(prev).length) save(fresh);
        return fresh;
      });
    }, 1000);
    return () => clearInterval(tickRef.current);
  }, [isCollaborateur]);

  const registerWrite = useCallback((resourceId) => {
    if (!isCollaborateur || !resourceId) return;
    const id = String(resourceId);
    setWindows(prev => {
      const next = purge({ ...prev, [id]: Date.now() });
      save(next);
      return next;
    });
  }, [isCollaborateur]);

  const canModify = useCallback((resourceId) => {
    if (!isCollaborateur) return true; // Admin peut toujours modifier
    if (!resourceId) return false;
    const ts = windows[String(resourceId)];
    return !!ts && Date.now() - ts < WINDOW_MS;
  }, [isCollaborateur, windows]);

  const timeLeft = useCallback((resourceId) => {
    if (!isCollaborateur) return Infinity;
    const ts = windows[String(resourceId)];
    if (!ts) return 0;
    return Math.max(0, Math.floor((WINDOW_MS - (Date.now() - ts)) / 1000));
  }, [isCollaborateur, windows]);

  const activeWrites = isCollaborateur ? windows : {};

  return { registerWrite, canModify, timeLeft, activeWrites };
};
