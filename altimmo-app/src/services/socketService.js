import { io } from 'socket.io-client';
import { getToken } from './api';
import { environment } from '../config/environment';

let socket = null;
let reconnectHandler = null;
let activeConversationId = null;

export const connectSocket = async () => {
  if (socket) {
    if (!socket.connected) socket.connect();
    return socket;
  }
  const token = await getToken();
  if (!token) return null;

  socket = io(environment.socketUrl, {
    auth: { token },
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
    if (socket) socket.auth = { token: freshToken };
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

export const disconnectSocket = () => {
  if (socket && reconnectHandler) {
    socket.io.off('reconnect_attempt', reconnectHandler);
  }
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
  reconnectHandler = null;
  activeConversationId = null;
};

export const getSocketDiagnostics = () => {
  if (!__DEV__ || !socket) return null;
  return {
    connected: socket.connected,
    listenerCount: socket.eventNames().reduce((total, event) => total + socket.listeners(event).length, 0),
    transport: socket.io.engine?.transport?.name || null,
  };
};
