const net = require('net');
const tls = require('tls');

const STATE_KEY = Symbol.for('altitudeVision.externalNetworkGuard');
const state = () => (globalThis[STATE_KEY] ||= { installed: false, blocked: [] });

function connectionTarget(args) {
  const first = args[0];
  if (typeof first === 'string') return { path: first };
  if (typeof first === 'number') return { port: first, host: typeof args[1] === 'string' ? args[1] : 'localhost' };
  return first && typeof first === 'object' ? first : {};
}

function isLoopback(host) {
  if (!host) return true;
  const value = String(host).toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  return value === 'localhost' || value === '127.0.0.1' || value === '::1'
    || value === '0:0:0:0:0:0:0:1' || value.startsWith('127.') || value.startsWith('::ffff:127.');
}

function assertAllowed(args) {
  if (process.env.TEST_EXTERNAL_NETWORK !== 'deny') return;
  const target = connectionTarget(args);
  if (target.path || isLoopback(target.host)) return;
  const error = new Error(`EXTERNAL_NETWORK_BLOCKED_IN_TEST: ${target.host}`);
  error.code = 'EXTERNAL_NETWORK_BLOCKED_IN_TEST';
  error.host = target.host;
  state().blocked.push({ host: String(target.host), code: error.code });
  throw error;
}

function installExternalNetworkGuard() {
  const current = state();
  if (current.installed) return;
  current.installed = true;
  const netConnect = net.connect;
  const netCreateConnection = net.createConnection;
  net.connect = function guardedNetConnect(...args) {
    assertAllowed(args);
    return netConnect.apply(this, args);
  };
  net.createConnection = function guardedNetCreateConnection(...args) {
    assertAllowed(args);
    return netCreateConnection.apply(this, args);
  };
  const socketConnect = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function guardedSocketConnect(...args) {
    assertAllowed(args);
    return socketConnect.apply(this, args);
  };
  const tlsConnect = tls.connect;
  tls.connect = function guardedTlsConnect(...args) {
    assertAllowed(args);
    return tlsConnect.apply(this, args);
  };
}

function takeBlockedAttempts() { return state().blocked.splice(0); }

if (process.env.TEST_EXTERNAL_NETWORK === 'deny') installExternalNetworkGuard();

module.exports = { installExternalNetworkGuard, isLoopback, takeBlockedAttempts };
