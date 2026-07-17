// Singleton Socket.IO — importer getIO() dans les controllers pour émettre des événements
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('./models/User');
const Conversation = require('./models/Conversation');
const logger = require('./utils/logger');

let _io = null;

// Tracking en mémoire des utilisateurs actuellement connectés via socket
// Clé : userId (string), Valeur : nombre de sockets actives (multi-onglet/device)
const onlineUsers = new Map();

const STAFF_ROLES = new Set(['Admin', 'Collaborateur']);

const canAccessConversation = async (user, conversationId) => {
  if (!mongoose.isValidObjectId(conversationId)) return false;
  const conversation = await Conversation.findById(conversationId)
    .select('participants isStaffInbox')
    .lean();
  if (!conversation) return false;

  const userId = user?._id?.toString();
  const isParticipant = conversation.participants?.some(
    (participantId) => participantId.toString() === userId,
  );
  const isStaffInboxMember = conversation.isStaffInbox && STAFF_ROLES.has(user?.role);
  return Boolean(isParticipant || isStaffInboxMember);
};

/**
 * Initialise Socket.IO sur le serveur HTTP.
 * À appeler une seule fois dans server.js.
 */
const initSocket = (httpServer, corsOptions) => {
  _io = new Server(httpServer, {
    cors: corsOptions,
    transports: ['websocket', 'polling'],
  });

  // Middleware d'auth JWT — même logique que authMiddleware.protect
  _io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentification requise'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');

      if (!user) return next(new Error('Utilisateur introuvable'));

      if (decoded.tokenVersion !== undefined && decoded.tokenVersion < user.tokenVersion) {
        return next(new Error('Session expirée, veuillez vous reconnecter'));
      }

      if (user.status === 'Suspendu' || user.status === 'Banni' || !user.isActive) {
        return next(new Error(`Accès refusé : compte ${user.status?.toLowerCase()}`));
      }

      socket.userId = user._id.toString();
      socket.user = user;
      next();
    } catch {
      next(new Error('Token invalide ou expiré'));
    }
  });

  _io.on('connection', (socket) => {
    // Incrémenter le compteur (un utilisateur peut avoir plusieurs sockets)
    onlineUsers.set(socket.userId, (onlineUsers.get(socket.userId) || 0) + 1);

    // Room personnelle = userId (pour push ciblé depuis les controllers)
    socket.join(socket.userId);

    const activeSocketsForUser = _io.sockets.adapter.rooms.get(socket.userId)?.size || 0;
    logger.info('[Socket] Connecté', {
      socketId: socket.id,
      userId: socket.userId,
      transport: socket.conn.transport.name,
      activeSocketsForUser,
    });

    socket.conn.on('upgrade', () => {
      logger.info('[Socket] Transport mis à niveau', {
        socketId: socket.id,
        userId: socket.userId,
        transport: socket.conn.transport.name,
      });
    });

    // Les messages sont exclusivement persistés et émis par les contrôleurs API.
    // Une room n'est accessible qu'à ses membres (ou au staff pour la boîte partagée).
    socket.on('join-room', async (conversationId, acknowledge) => {
      try {
        const allowed = await canAccessConversation(socket.user, conversationId);
        if (!allowed) {
          acknowledge?.({ ok: false, error: 'Accès refusé' });
          return;
        }
        socket.join(`conv:${conversationId}`);
        acknowledge?.({ ok: true });
      } catch (error) {
        logger.error('[Socket] Échec de vérification de conversation', {
          userId: socket.userId,
          error,
        });
        acknowledge?.({ ok: false, error: 'Vérification impossible' });
      }
    });

    socket.on('leave-room', (conversationId) => {
      if (!mongoose.isValidObjectId(conversationId)) return;
      socket.leave(`conv:${conversationId}`);
    });

    // Relayer l'indicateur "en train d'écrire" aux autres membres de la conv
    socket.on('typing', ({ conversationId } = {}) => {
      const room = `conv:${conversationId}`;
      if (!socket.rooms.has(room)) return;
      socket.to(room).emit('typing', { userId: socket.userId });
    });

    socket.on('disconnect', (reason) => {
      const remaining = (onlineUsers.get(socket.userId) || 1) - 1;
      if (remaining <= 0) {
        onlineUsers.delete(socket.userId);
      } else {
        onlineUsers.set(socket.userId, remaining);
      }
      logger.info('[Socket] Déconnecté', {
        socketId: socket.id,
        userId: socket.userId,
        reason,
        remainingSocketsForUser: Math.max(0, remaining),
      });
    });
  });

  console.log('✅ [Socket] Socket.IO initialisé');
  return _io;
};

/**
 * Retourne l'instance io déjà initialisée.
 * Utilisable dans n'importe quel controller :
 *   const { getIO } = require('../socket');
 *   getIO().to(userId).emit('new-message', payload);
 */
const getIO = () => {
  if (!_io) throw new Error('[Socket] getIO() appelé avant initSocket()');
  return _io;
};

/**
 * Vérifie si un utilisateur a au moins un socket actif.
 * Utilisé dans messageController pour décider si un push est nécessaire.
 */
const isUserOnline = (userId) => onlineUsers.has(userId.toString());

module.exports = { initSocket, getIO, isUserOnline, canAccessConversation };
