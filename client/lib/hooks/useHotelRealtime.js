'use client';

import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { usePlatformTenantRuntime } from '../context/PlatformTenantRuntimeContext';

export default function useHotelRealtime(hotelId, onUpdate) {
  const callbackRef = useRef(onUpdate);
  const { selectedTenantId } = usePlatformTenantRuntime();

  useEffect(() => { callbackRef.current = onUpdate; }, [onUpdate]);

  useEffect(() => {
    if (!hotelId || typeof window === 'undefined') return undefined;
    const token = localStorage.getItem('token');
    if (!token) return undefined;
    const socketUrl = (process.env.NEXT_PUBLIC_API_URL || '').replace('/api', '') || 'http://localhost:5000';
    const socket = io(socketUrl, { auth: { token, platformTenantId: selectedTenantId || undefined } });
    const join = () => socket.emit('establishment:join', { type: 'hotel', id: hotelId });
    const update = (payload) => {
      if (String(payload?.hotelId) !== String(hotelId)) return;
      callbackRef.current?.(payload);
    };
    socket.on('connect', join);
    socket.on('hospitality:updated', update);
    return () => {
      socket.emit('establishment:leave', { type: 'hotel', id: hotelId });
      socket.off('connect', join);
      socket.off('hospitality:updated', update);
      socket.disconnect();
    };
  }, [hotelId, selectedTenantId]);
}
