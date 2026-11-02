'use strict';
// Flux SSE renvoyé par un POST : événements fermés, données JSON sur une seule ligne.
// `no-transform` : le middleware global `compression()` ne met pas le flux en tampon.
const SSE_EVENTS = new Set(['status', 'delta', 'facts', 'final', 'error']);

function encodeSse(event, data) {
  if (!SSE_EVENTS.has(event)) throw new Error('Type d’événement SSE interdit.');
  return `event: ${event}\ndata: ${JSON.stringify(data ?? {})}\n\n`;
}

function openSse(res) {
  res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store, no-transform', connection: 'keep-alive', 'x-accel-buffering': 'no', 'x-content-type-options': 'nosniff' });
  res.flushHeaders?.();
  let terminal = false;
  return {
    send(event, data) {
      if (terminal || res.writableEnded || res.destroyed) return false;
      if (event === 'final' || event === 'error') terminal = true;
      return res.write(encodeSse(event, data));
    },
    close() { if (!res.writableEnded) res.end(); },
    get terminal() { return terminal; },
  };
}

module.exports = { SSE_EVENTS, encodeSse, openSse };
