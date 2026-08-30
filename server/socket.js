// Singleton Socket.IO — importer getIO() dans les controllers pour émettre des événements
const crypto = require('crypto');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const Redis = require('ioredis');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('./models/User');
const Conversation = require('./models/Conversation');
const { resolveEffectiveTenantContext } = require('./services/platformTenant/tenantContextService');
const logger = require('./utils/logger');

let _io = null;

// HOTFIX-SCALABILITY-P1-SOCKETIO-DISTRIBUTED-ADAPTER-1 — identifiant unique
// du processus, généré une fois au boot. Ne remplace jamais un secret ;
// utilisé uniquement pour distinguer les instances dans les logs et l'état
// realtime exposé par /api/ready (voir REALTIME_STATE ci-dessous).
const INSTANCE_ID = process.env.INSTANCE_ID || crypto.randomUUID();

// Compteur LOCAL diagnostique uniquement (logs de connexion/déconnexion).
// Ce Map n'est PLUS la source d'autorité de présence — voir isUserOnline()
// ci-dessous, qui interroge l'adaptateur (donc le cluster entier dès que
// Redis est configuré) via fetchSockets() sur la room utilisateur, déjà
// existante. Conservé uniquement pour ne pas perdre le compteur
// `activeSocketsForUser`/`remainingSocketsForUser` déjà utile en local.
const onlineUsers = new Map();

// État realtime observable (jamais de secret dedans) — exposé par
// getRealtimeStatus() pour /api/ready et les logs. Décision explicite de ce
// hotfix (§14 du mandat) : DEGRADE, ne jamais fail-startup. Sans REDIS_URL,
// ou si Redis devient indisponible, le serveur continue de fonctionner en
// DEGRADED LOCAL REALTIME — exactement le comportement mono-instance déjà
// certifié par l'audit précédent (Verdict B) — plutôt que de refuser de
// démarrer pour une dépendance non critique pour l'intégrité des données
// (Mongo reste la source de vérité, voir §20/§96 du mandat).
let realtimeState = { adapter: 'memory', redisConnected: false, degraded: true, reason: 'not_initialized', instanceId: INSTANCE_ID };

const getRealtimeStatus = () => ({ ...realtimeState });

/**
 * Configure l'adaptateur Redis distribué si REDIS_URL est défini. N'échoue
 * jamais le boot : toute erreur (absence de config, échec de connexion,
 * perte ultérieure) fait basculer realtimeState en mode dégradé et laisse
 * Socket.IO fonctionner avec son adaptateur mémoire par défaut (le
 * comportement mono-instance déjà certifié reste intact).
 */
async function configureRedisAdapter(io) {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    realtimeState = { adapter: 'memory', redisConnected: false, degraded: true, reason: 'REDIS_URL non configuré', instanceId: INSTANCE_ID };
    logger.warn('[Socket] REDIS_URL absent — realtime en DEGRADED LOCAL (adapter mémoire, mono-instance)', { instanceId: INSTANCE_ID });
    return;
  }

  const pubClient = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: null, enableReadyCheck: true });
  const subClient = pubClient.duplicate();

  const markDegraded = (reason) => {
    if (!realtimeState.degraded) {
      logger.error('[Socket] Redis indisponible — bascule DEGRADED LOCAL REALTIME (les instances redeviennent isolées ; Mongo/polling restent le filet de récupération)', { instanceId: INSTANCE_ID, reason });
    }
    realtimeState = { adapter: 'memory', redisConnected: false, degraded: true, reason, instanceId: INSTANCE_ID };
  };
  pubClient.on('error', (error) => markDegraded(error.message));
  subClient.on('error', (error) => markDegraded(error.message));

  try {
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    realtimeState = { adapter: 'redis', redisConnected: true, degraded: false, reason: null, instanceId: INSTANCE_ID };
    logger.success('[Socket] Adapter Redis actif — realtime distribué entre instances', { instanceId: INSTANCE_ID });
  } catch (error) {
    markDegraded(error.message);
  }
}

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
let _adapterReadyPromise = Promise.resolve();

const initSocket = (httpServer, corsOptions) => {
  _io = new Server(httpServer, {
    cors: corsOptions,
    transports: ['websocket', 'polling'],
  });

  // Ne bloque jamais initSocket() (comportement synchrone historique
  // préservé pour server.js et les tests existants) — configureRedisAdapter
  // ne peut de toute façon jamais faire échouer le boot (§14/§15 du
  // mandat). Les tests qui doivent affirmer un comportement cross-instance
  // attendent explicitement `getRealtimeReadyPromise()` avant leurs
  // assertions.
  _adapterReadyPromise = configureRedisAdapter(_io);

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
      // HOTFIX-SCALABILITY-P1-SOCKETIO-DISTRIBUTED-ADAPTER-1 — `socket.data`
      // est le seul sac de propriétés répliqué par l'adaptateur distribué
      // vers les RemoteSocket renvoyés par fetchSockets() sur une autre
      // instance. Les propriétés posées directement sur `socket` (userId,
      // user, authTokenVersion, platformTenantId ci-dessus) restent
      // utilisables telles quelles pour tout code qui s'exécute dans LE
      // handler de connexion de CETTE instance (inchangé, zéro régression),
      // mais emitHotelEvent() doit pouvoir réautoriser un socket qui vit sur
      // une AUTRE instance : on duplique donc ici le strict minimum
      // sérialisable (jamais le document Mongoose complet) dans socket.data.
      socket.data.userId = socket.userId;
      socket.data.platformTenantId = socket.platformTenantId;
      socket.data.authTokenVersion = socket.authTokenVersion;
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
      instanceId: INSTANCE_ID,
      socketId: socket.id,
      userId: socket.userId,
      transport: socket.conn.transport.name,
      // Local à cette instance uniquement — pas le compte cluster-wide
      // (utiliser isUserOnline()/fetchSockets() pour la présence réelle).
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
        instanceId: INSTANCE_ID,
        socketId: socket.id,
        userId: socket.userId,
        reason,
        // Local à cette instance uniquement, voir commentaire à la connexion.
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
 * HOTFIX-SCALABILITY-P1-SOCKETIO-DISTRIBUTED-ADAPTER-1 — Vérifie si un
 * utilisateur a au moins un socket actif, N'IMPORTE OÙ SUR LE CLUSTER.
 *
 * Avant ce hotfix, cette fonction lisait `onlineUsers` (Map process-local) :
 * un utilisateur connecté uniquement sur une AUTRE instance que celle qui
 * exécute ce code était incorrectement vu comme hors-ligne (P1 documenté
 * dans SCALABILITY_P1_SOCKETIO_DISTRIBUTED_STATE_AUDIT1_REPORT.md §7/§18/§38).
 *
 * `_io.in(userId).fetchSockets()` est la primitive Socket.IO conçue pour
 * cet usage : elle délègue à l'adaptateur configuré. Avec l'adaptateur
 * mémoire (Redis absent/indisponible), elle se comporte exactement comme
 * l'ancien Map local (mono-instance, comportement inchangé). Avec
 * l'adaptateur Redis, elle interroge le cluster entier via la room
 * utilisateur déjà existante (`socket.join(socket.userId)`), sans nouveau
 * datastore de présence ni heartbeat custom (mandat §33/§34).
 *
 * Fail-closed explicite : si fetchSockets() échoue (ex. Redis tombe pendant
 * l'appel), on considère l'utilisateur hors-ligne plutôt que de risquer de
 * supprimer à tort un push de secours — un push redondant est un désagrément
 * mineur, un push manqué peut être une notification jamais vue à temps.
 */
const isUserOnline = async (userId) => {
  if (!_io) return false;
  try {
    const sockets = await _io.in(userId.toString()).fetchSockets();
    return sockets.length > 0;
  } catch (error) {
    logger.error('[Socket] fetchSockets() a échoué — présence non déterminable, traité comme hors-ligne par prudence', {
      instanceId: INSTANCE_ID, error: error.message,
    });
    return false;
  }
};

/**
 * HOTFIX-SCALABILITY-P1-SOCKETIO-DISTRIBUTED-ADAPTER-1 — emitHotelEvent
 * réécrit pour être cross-instance-safe.
 *
 * L'ancienne implémentation lisait directement `_io.sockets.adapter.rooms`
 * et `_io.sockets.sockets` — des structures strictement LOCALES au
 * processus quel que soit l'adaptateur configuré (confirmé par l'audit,
 * §21 : Socket.IO ne synchronise jamais ces Maps internes entre instances,
 * même avec un adaptateur distribué — seules les primitives de haut niveau
 * comme fetchSockets()/to().emit() sont conscientes du cluster). C'était le
 * seul point de tout le realtime applicatif qui contournait l'abstraction
 * Adapter ; `notificationService.js`/`conversationController.js`/
 * `messageController.js` utilisaient déjà `getIO().to(id).emit(...)`, qui
 * devient automatiquement cross-instance dès que l'adaptateur Redis est actif
 * — aucun changement n'a donc été nécessaire dans ces fichiers.
 *
 * `fetchSockets()` sur la room hôtel renvoie soit de vrais Socket locaux,
 * soit des RemoteSocket (pour les sockets d'autres instances) qui exposent
 * `.data`, `.emit()`, `.leave()`, `.disconnect()` — suffisant pour préserver
 * EXACTEMENT la même logique de réautorisation/auto-nettoyage qu'avant
 * (session revalidée, membre plus autorisé éjecté de la room, session
 * révoquée déconnectée de force), simplement lue depuis `socket.data`
 * (répliqué par l'adaptateur) au lieu des propriétés locales `socket.userId`
 * /`socket.platformTenantId`/`socket.authTokenVersion`.
 */
async function emitHotelEvent(hotelId, payload = {}) {
  if (!_io || !mongoose.isValidObjectId(hotelId)) return { delivered: 0 };
  const room = hotelRoom(hotelId);
  const sockets = await _io.in(room).fetchSockets();
  let delivered = 0;
  for (const socket of sockets) {
    const userId = socket.data.userId;
    const freshUser = userId ? await User.findById(userId).select('-password') : null;
    const sessionValid = freshUser && freshUser.isActive && !['Suspendu', 'Banni'].includes(freshUser.status)
      && (socket.data.authTokenVersion === undefined || socket.data.authTokenVersion >= freshUser.tokenVersion);
    const allowed = sessionValid && await canAccessHotel(freshUser, hotelId, socket.data.platformTenantId).catch(() => false);
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

const getRealtimeReadyPromise = () => _adapterReadyPromise;

module.exports = {
  initSocket, getIO, isUserOnline, canAccessConversation, canAccessHotel, hotelRoom, emitHotelEvent,
  getRealtimeStatus, getRealtimeReadyPromise, INSTANCE_ID,
};
