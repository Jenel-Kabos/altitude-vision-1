import { io } from 'socket.io-client';
import { getToken } from './api';

const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || 'https://altitude-vision.onrender.com';

let socket = null;

export const connectSocket = async () => {
  if (socket?.connected) return socket;
  const token = await getToken();
  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionAttempts: 10,
  });

  socket.on('reconnect_attempt', async () => {
    const freshToken = await getToken();
    socket.auth = { token: freshToken };
  });

  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  socket?.disconnect();
  socket = null;
};
