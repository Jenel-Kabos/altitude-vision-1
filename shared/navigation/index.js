'use strict';

const registry = require('./registry.json');

const byId = new Map(registry.destinations.map((destination) => [destination.id, destination]));

function getDestination(id) {
  return id ? byId.get(id) || null : null;
}

function interpolate(value, params = {}) {
  if (typeof value === 'string') {
    return value.replace(/:([A-Za-z0-9_]+)/g, (match, key) => {
      const replacement = params[key];
      return replacement === undefined || replacement === null ? match : encodeURIComponent(String(replacement));
    });
  }
  if (Array.isArray(value)) return value.map((item) => interpolate(item, params));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, interpolate(item, params)]));
  }
  return value;
}

function canAccess(destination, { authenticated = false, role = null } = {}) {
  if (!destination) return false;
  if (destination.requiresAuth && !authenticated) return false;
  return destination.roles.length === 0 || destination.roles.includes(role);
}

function resolve(id, platform, params = {}) {
  const destination = getDestination(id);
  if (!destination) return null;
  const field = platform === 'web' ? 'webRoute' : platform === 'mobile' ? 'mobileRoute' : null;
  return field ? interpolate(destination[field], params) : null;
}

function buildDeepLink(id, params = {}, universal = false) {
  const destination = getDestination(id);
  if (!destination) return null;
  const template = universal ? destination.universalLink : destination.deepLink;
  if (!template) return null;
  const path = interpolate(template, params);
  return universal
    ? `${registry.origins.web}${path.startsWith('/') ? path : `/${path}`}`
    : `${registry.origins.scheme}://${path.replace(/^\//, '')}`;
}

module.exports = { registry, getDestination, interpolate, canAccess, resolve, buildDeepLink };
