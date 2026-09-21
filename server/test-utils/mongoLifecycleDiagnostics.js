// Opt-in, local-test diagnostics. Never records URIs or command payloads.
const { appendFileSync } = require('fs');

function observeMongoLifecycle(client) {
  const destination = process.env.TEST_MONGO_LIFECYCLE_LOG;
  if (!destination) return { record() {}, stop() {} };
  const pending = new Map();
  const connections = new Set();
  let checkedOut = 0;
  const handlers = {
    commandStarted(event) { pending.set(event.requestId, { command: event.commandName, since: Date.now() }); },
    commandSucceeded(event) { pending.delete(event.requestId); },
    commandFailed(event) { pending.delete(event.requestId); },
    connectionCreated(event) { connections.add(event.connectionId); },
    connectionClosed(event) { connections.delete(event.connectionId); },
    connectionCheckedOut() { checkedOut += 1; },
    connectionCheckedIn() { checkedOut -= 1; },
  };
  for (const [event, handler] of Object.entries(handlers)) client.on(event, handler);
  function record(stage) {
    const sessions = [...client.s.activeSessions];
    appendFileSync(destination, `${JSON.stringify({
      at: new Date().toISOString(), pid: process.pid, stage,
      sessions: sessions.length,
      explicitSessions: sessions.filter((session) => session.explicit).length,
      transactions: sessions.filter((session) => session.inTransaction()).length,
      connections: connections.size, checkedOut,
      pending: [...pending.values()].map(({ command, since }) => ({ command, ageMs: Date.now() - since })),
      handles: process._getActiveHandles().map((handle) => handle.constructor.name),
    })}\n`);
  }
  const interval = setInterval(() => record('tick'), 10000);
  interval.unref();
  return {
    record,
    stop() {
      clearInterval(interval);
      for (const [event, handler] of Object.entries(handlers)) client.off(event, handler);
    },
  };
}

module.exports = { observeMongoLifecycle };
