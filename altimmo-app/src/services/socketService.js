import { io } from 'socket.io-client';
import { getToken, getValidatedPlatformTenant } from './api';
import { environment } from '../config/environment';

let socket = null;
let reconnectHandler = null;
let activeConversationId = null;
// SYNC-2A — room hôtel active courante (contrat DASH-4 : `establishment:join`
// /`establishment:leave` avec `{ type: 'hotel', id }`, jamais un nom de room
// construit côté client). Non consommé par aucun écran mobile pour
// l'instant — préparé pour SYNC-2C/2D, testé isolément ici.
let activeHotelId = null;

export const connectSocket = async () => {
  if (socket) {
    if (!socket.connected) socket.connect();
    return socket;
  }
  const token = await getToken();
  if (!token) return null;

  socket = io(environment.socketUrl, {
    auth: { token, platformTenantId: getValidatedPlatformTenant() || undefined },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    randomizationFactor: 0.5,
    reconnectionAttempts: 10,
    autoConnect: true,
  });

  reconnectHandler = async () => {
    const freshToken = await getToken();
    if (socket) socket.auth = { token: freshToken, platformTenantId: getValidatedPlatformTenant() || undefined };
  };
  socket.io.on('reconnect_attempt', reconnectHandler);

  return socket;
};

export const getSocket = () => socket;

export const joinConversation = async (conversationId) => {
  if (!conversationId) return false;
  const connectedSocket = await connectSocket();
  if (!connectedSocket) return false;
  if (activeConversationId === conversationId) return true;
  if (activeConversationId) connectedSocket.emit('leave-room', activeConversationId);
  connectedSocket.emit('join-room', conversationId);
  activeConversationId = conversationId;
  return true;
};

export const leaveConversation = (conversationId = activeConversationId) => {
  if (!socket || !conversationId) return;
  socket.emit('leave-room', conversationId);
  if (conversationId === activeConversationId) activeConversationId = null;
};

// SYNC-2A — contrat DASH-4 exact (voir server/socket.js `establishment:join`)
// : acquittement `{ ok, hotelId }` / `{ ok: false, error }`. Le serveur
// revalide session, tenant et droit d'accès à CHAQUE join — aucune
// confiance accordée côté client. Promesse résolue avec l'acquittement brut,
// jamais une supposition de succès.
export const joinHotelRoom = async (hotelId) => {
  if (!hotelId) return { ok: false, error: 'hotelId requis' };
  const connectedSocket = await connectSocket();
  if (!connectedSocket) return { ok: false, error: 'Socket indisponible' };
  if (activeHotelId && activeHotelId !== hotelId) await leaveHotelRoom(activeHotelId);
  return new Promise((resolve) => {
    connectedSocket.emit('establishment:join', { type: 'hotel', id: hotelId }, (ack) => {
      if (ack?.ok) activeHotelId = hotelId;
      resolve(ack || { ok: false, error: 'Pas de réponse serveur' });
    });
  });
};

export const leaveHotelRoom = async (hotelId = activeHotelId) => {
  if (!socket || !hotelId) return { ok: false };
  return new Promise((resolve) => {
    socket.emit('establishment:leave', { type: 'hotel', id: hotelId }, (ack) => {
      if (hotelId === activeHotelId) activeHotelId = null;
      resolve(ack || { ok: true });
    });
  });
};

export const disconnectSocket = () => {
  if (socket && reconnectHandler) {
    socket.io.off('reconnect_attempt', reconnectHandler);
  }
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
  reconnectHandler = null;
  activeConversationId = null;
  activeHotelId = null;
};

export const getSocketDiagnostics = () => {
  if (!__DEV__ || !socket) return null;
  return {
    connected: socket.connected,
    listenerCount: socket.eventNames().reduce((total, event) => total + socket.listeners(event).length, 0),
    transport: socket.io.engine?.transport?.name || null,
  };
};
