import navigationRegistryData from '../../../shared/navigation/registry.json';

export const navigationRegistry = navigationRegistryData;
export const getDestination = (id) => navigationRegistry.destinations.find((item) => item.id === id) || null;
const interpolate = (value, params = {}) => value?.replace(/:([A-Za-z0-9_]+)/g, (match, key) => (
  params[key] === undefined || params[key] === null ? match : encodeURIComponent(String(params[key]))
));
// USER-ARCH-UX-1 (Phase 5) — `profiles` est additif et rétrocompatible : un
// appelant qui ne le fournit pas (défaut []) obtient exactement le même
// résultat qu'avant (contrôle uniquement par `role`). Une destination qui
// déclare `profiles` (ex. MY_ESTABLISHMENTS → ['exploitant_etablissement'])
// devient accessible si le rôle correspond OU si l'utilisateur porte l'un
// des profils métiers effectifs déclarés — jamais l'un à la place de l'autre.
export const canAccessDestination = (destination, { authenticated = false, role = null, profiles = [] } = {}) => Boolean(
  destination && (!destination.requiresAuth || authenticated)
  && (
    destination.roles.length === 0
    || destination.roles.includes(role)
    || (destination.profiles || []).some((p) => profiles.includes(p))
  )
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
