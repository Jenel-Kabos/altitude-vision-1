// HOTFIX-SCALABILITY-P1-SOCKETIO-DISTRIBUTED-ADAPTER-1 — process ENFANT
// séparé, démarré via child_process.fork() par
// socketDistributedAdapter.mongo.integration.test.js.
//
// Chaque instance "serveur" du test est un VRAI process Node distinct, avec
// son propre singleton socket.js (donc son propre `_io`, son propre
// adaptateur), connecté au même Mongo et au même Redis que les autres
// instances via des variables d'environnement. Ceci évite toute
// contamination de singleton entre "serveurs" (le piège d'un simple
// `jest.isolateModules` avec des modèles Mongoose déjà enregistrés) et
// satisfait l'exigence du mandat : deux serveurs Socket.IO réellement
// distincts, jamais deux clients sur un seul serveur, jamais un mock de
// getIO().
//
// Protocole IPC (process.send / process.on('message')) : le process de test
// (parent) pilote ce process enfant pour déclencher, DEPUIS le contexte de
// CETTE instance, les mêmes primitives que le code applicatif utiliserait
// réellement (getIO().to(...).emit(...), emitHotelEvent(), isUserOnline()).
const http = require('http');
const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const socket = require('../../socket');
  const server = http.createServer();
  socket.initSocket(server, { origin: '*' });
  await socket.getRealtimeReadyPromise();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  process.on('message', async (msg) => {
    if (!msg || typeof msg !== 'object') return;
    try {
      if (msg.type === 'emitToUser') {
        socket.getIO().to(msg.userId).emit(msg.event, msg.payload);
        process.send({ type: 'result', requestId: msg.requestId, result: true });
      } else if (msg.type === 'emitToRoom') {
        socket.getIO().to(msg.room).emit(msg.event, msg.payload);
        process.send({ type: 'result', requestId: msg.requestId, result: true });
      } else if (msg.type === 'emitHotelEvent') {
        const result = await socket.emitHotelEvent(msg.hotelId, msg.payload);
        process.send({ type: 'result', requestId: msg.requestId, result });
      } else if (msg.type === 'isUserOnline') {
        const online = await socket.isUserOnline(msg.userId);
        process.send({ type: 'result', requestId: msg.requestId, result: online });
      } else if (msg.type === 'getRealtimeStatus') {
        process.send({ type: 'result', requestId: msg.requestId, result: socket.getRealtimeStatus() });
      }
    } catch (error) {
      process.send({ type: 'result', requestId: msg.requestId, error: error.message });
    }
  });

  process.send({ type: 'ready', port });
}

process.on('SIGTERM', () => process.exit(0));
main().catch((error) => {
  process.send({ type: 'boot_error', error: error.message });
  process.exit(1);
});
