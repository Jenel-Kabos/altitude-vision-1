// Singleton Socket.IO — importer getIO() dans les controllers pour émettre des événements
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('./models/User');
const Conversation = require('./models/Conversation');
const { resolveEffectiveTenantContext } = require('./services/platformTenant/tenantContextService');
const logger = require('./utils/logger');

let _io = null;

// Tracking en mémoire des utilisateurs actuellement connectés via socket
// Clé : userId (string), Valeur : nombre de sockets actives (multi-onglet/device)
const onlineUsers = new Map();

const STAFF_ROLES = new Set(['Admin', 'Collaborateur']);
const HOTEL_ROOM_PREFIX = 'hotel:';
const hotelRoom = (hotelId) => `${HOTEL_ROOM_PREFIX}${String(hotelId)}`;

const canAccessHotel = async (user, hotelId, activeTenantId = null) => {
  if (!mongoose.isValidObjectId(hotelId)) return false;
  const actor = user?.toObject ? user.toObject() : { ...user };
  actor.platformTenant = activeTenantId || actor.platformTenant || null;
  const { assertOperationalHotelAccess } = require('./services/hotel/hotelAccessScopeService');
  const access = await assertOperationalHotelAccess({ actor, hotelId });
  return !access?.error;
};

const canAccessConversation = async (user, conversationId, activeTenantId = null) => {
  if (!mongoose.isValidObjectId(conversationId)) return false;
  const conversation = await Conversation.findById(conversationId)
    .select('participants isStaffInbox tenant')
    .lean();
  if (!conversation) return false;

  // Une room est une frontière de données au même titre qu'une route HTTP.
  // Si la conversation est attribuée, le contexte socket actif doit être le
  // même avant de considérer participant ou rôle staff.
  if (conversation.tenant && (!activeTenantId || String(conversation.tenant) !== String(activeTenantId))) return false;

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
      socket.authTokenVersion = decoded.tokenVersion;
      const requestedTenantId = socket.handshake.auth?.platformTenantId
        || socket.handshake.headers?.['x-platform-tenant-id']
        || socket.handshake.headers?.['x-tenant-id']
        || null;
      const tenantContext = await resolveEffectiveTenantContext(user._id, requestedTenantId);
      if (!tenantContext?.tenant) return next(new Error('Contexte tenant requis'));
      socket.platformTenantId = String(tenantContext.tenant._id);
      socket.user.platformTenant = tenantContext.tenant._id;
      socket.tenantContextSource = tenantContext.source;
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

    socket.on('establishment:join', async ({ type, id } = {}, acknowledge) => {
      if (type !== 'hotel' || !mongoose.isValidObjectId(id)) {
        acknowledge?.({ ok: false, error: 'Établissement invalide' });
        return;
      }
      try {
        const freshUser = await User.findById(socket.userId).select('-password');
        const sessionValid = freshUser && freshUser.isActive && !['Suspendu', 'Banni'].includes(freshUser.status)
          && (socket.authTokenVersion === undefined || socket.authTokenVersion >= freshUser.tokenVersion);
        if (!sessionValid || !await canAccessHotel(freshUser, id, socket.platformTenantId)) {
          acknowledge?.({ ok: false, error: 'Accès refusé' });
          return;
        }
        if (socket.data.activeHotelRoom) await socket.leave(socket.data.activeHotelRoom);
        const room = hotelRoom(id);
        await socket.join(room);
        socket.data.activeHotelRoom = room;
        socket.data.activeHotelId = String(id);
        logger.info('[Socket] Room hôtel rejointe', { userId: socket.userId, hotelId: String(id) });
        acknowledge?.({ ok: true, hotelId: String(id) });
      } catch {
        acknowledge?.({ ok: false, error: 'Vérification impossible' });
      }
    });

    socket.on('establishment:leave', async ({ type, id } = {}, acknowledge) => {
      if (type !== 'hotel' || !mongoose.isValidObjectId(id)) {
        acknowledge?.({ ok: false, error: 'Établissement invalide' });
        return;
      }
      const room = hotelRoom(id);
      await socket.leave(room);
      if (socket.data.activeHotelRoom === room) {
        delete socket.data.activeHotelRoom;
        delete socket.data.activeHotelId;
      }
      logger.info('[Socket] Room hôtel quittée', { userId: socket.userId, hotelId: String(id) });
      acknowledge?.({ ok: true });
    });

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
        const allowed = await canAccessConversation(socket.user, conversationId, socket.platformTenantId);
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

async function emitHotelEvent(hotelId, payload = {}) {
  if (!_io || !mongoose.isValidObjectId(hotelId)) return { delivered: 0 };
  const room = hotelRoom(hotelId);
  const socketIds = [...(_io.sockets.adapter.rooms.get(room) || [])];
  let delivered = 0;
  for (const socketId of socketIds) {
    const socket = _io.sockets.sockets.get(socketId);
    if (!socket) continue;
    const freshUser = await User.findById(socket.userId).select('-password');
    const sessionValid = freshUser && freshUser.isActive && !['Suspendu', 'Banni'].includes(freshUser.status)
      && (socket.authTokenVersion === undefined || socket.authTokenVersion >= freshUser.tokenVersion);
    const allowed = sessionValid && await canAccessHotel(freshUser, hotelId, socket.platformTenantId).catch(() => false);
    if (!allowed) {
      await socket.leave(room);
      if (!sessionValid) socket.disconnect(true);
      continue;
    }
    socket.emit('hospitality:updated', {
      hotelId: String(hotelId),
      eventType: String(payload.eventType || 'hotel.updated'),
      entityType: payload.entityType || null,
      entityId: payload.entityId ? String(payload.entityId) : null,
      status: payload.status || null,
      updatedAt: new Date().toISOString(),
    });
    delivered += 1;
  }
  return { delivered };
}

module.exports = { initSocket, getIO, isUserOnline, canAccessConversation, canAccessHotel, hotelRoom, emitHotelEvent };
