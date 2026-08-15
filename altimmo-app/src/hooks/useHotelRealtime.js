import { useEffect, useRef } from 'react';
import { connectSocket, getSocket, joinHotelRoom, leaveHotelRoom } from '../services/socketService';

// SYNC-2B — consomme le socket singleton déjà authentifié/contextualisé par
// SYNC-2A (joinHotelRoom/leaveHotelRoom, contrat exact DASH-4). Le realtime
// n'est ici qu'un SIGNAL de rafraîchissement (mandat §34) : `onUpdate` doit
// systématiquement redéclencher un appel HTTP existant, jamais muter l'état
// local directement à partir du payload socket. Rejoint automatiquement au
// (re)connect (mandat §38) — le serveur revalide session/tenant/ownership à
// chaque `establishment:join`, jamais une confiance côté client.
export default function useHotelRealtime(hotelId, onUpdate) {
  const callbackRef = useRef(onUpdate);
  useEffect(() => { callbackRef.current = onUpdate; }, [onUpdate]);

  useEffect(() => {
    if (!hotelId) return undefined;
    let cancelled = false;

    const handleUpdate = (payload) => {
      if (String(payload?.hotelId) !== String(hotelId)) return; // mandat §39 — jamais de fuite cross-hôtel
      callbackRef.current?.(payload);
    };
    const rejoin = () => { if (!cancelled) joinHotelRoom(hotelId); };

    connectSocket().then((socket) => {
      if (cancelled || !socket) return;
      socket.on('hospitality:updated', handleUpdate);
      socket.on('connect', rejoin);
      if (socket.connected) rejoin();
    });

    return () => {
      cancelled = true;
      const socket = getSocket();
      socket?.off('hospitality:updated', handleUpdate);
      socket?.off('connect', rejoin);
      leaveHotelRoom(hotelId);
    };
  }, [hotelId]);
}
