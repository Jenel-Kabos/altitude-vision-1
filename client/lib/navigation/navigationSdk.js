import navigationRegistryData from '../../../shared/navigation/registry.json';

export const navigationRegistry = navigationRegistryData;
export const getDestination = (id) => navigationRegistry.destinations.find((item) => item.id === id) || null;
const interpolate = (value, params = {}) => value?.replace(/:([A-Za-z0-9_]+)/g, (match, key) => (
  params[key] === undefined || params[key] === null ? match : encodeURIComponent(String(params[key]))
));
export const canAccessDestination = (destination, { authenticated = false, role = null } = {}) => Boolean(
  destination && (!destination.requiresAuth || authenticated)
  && (destination.roles.length === 0 || destination.roles.includes(role))
);

export function resolveWebDestination(destination, params = {}) {
  return interpolate(getDestination(destination)?.webRoute, params) || null;
}

export function resolveNotificationWebRoute(notification, fallback = '/') {
  const data = notification?.data || notification?.metadata || {};
  const id = notification?.entityId || data.entityId || data.applicationId || data.conversationId;
  return resolveWebDestination(notification?.destination || data.destination, { ...data, id })
    || notification?.link
    || data.webPath
    || fallback;
}
