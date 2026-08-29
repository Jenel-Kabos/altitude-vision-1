import navigationRegistryData from '../../../shared/navigation/registry.json';

export const navigationRegistry = navigationRegistryData;
export const getDestination = (id) => navigationRegistry.destinations.find((item) => item.id === id) || null;
const interpolate = (value, params = {}) => {
  if (typeof value === 'string') return value.replace(/:([A-Za-z0-9_]+)/g, (match, key) => (
    params[key] === undefined || params[key] === null ? match : encodeURIComponent(String(params[key]))
  ));
  if (Array.isArray(value)) return value.map((item) => interpolate(item, params));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, interpolate(item, params)]));
  }
  return value;
};
// USER-ARCH-UX-1 (Phase 5/6) — même contrat additif que la version web
// (client/lib/navigation/navigationSdk.js) : `profiles` par défaut [] ne
// change rien pour les appelants existants.
export const canAccessDestination = (destination, { authenticated = false, role = null, profiles = [] } = {}) => Boolean(
  destination && (!destination.requiresAuth || authenticated)
  && (
    destination.roles.length === 0
    || destination.roles.includes(role)
    || (destination.profiles || []).some((p) => profiles.includes(p))
  )
);

export function resolveMobileDestination(destination, params = {}) {
  const route = getDestination(destination)?.mobileRoute;
  return route ? interpolate(route, params) : null;
}

// HOTFIX-MOBILE-PROPERTY-SHARE-CANONICAL-URL-1 — même contrat que
// client/lib/navigation/navigationSdk.js::resolveWebDestination : dérive
// l'URL web publique d'une destination depuis le registre partagé
// (`webRoute`), pour que tout lien externe construit côté mobile (partage,
// deep-link universel) pointe toujours vers une route Next.js réellement
// déployée, sans jamais dupliquer un chemin en dur.
export function resolveWebDestination(destination, params = {}) {
  const route = getDestination(destination)?.webRoute;
  return route ? interpolate(route, params) : null;
}

export function resolveNotificationMobileTarget(notification = {}) {
  const data = notification.data || notification.metadata || notification;
  const id = notification.entityId || data.entityId || data.applicationId || data.conversationId;
  return resolveMobileDestination(notification.destination || data.destination, { ...data, id });
}

const pathFor = (id) => getDestination(id)?.deepLink || undefined;

export const linking = {
  prefixes: [
    `${navigationRegistry.origins.scheme}://`,
    navigationRegistry.origins.web,
  ],
  config: {
    screens: {
      Main: {
        screens: {
          Annonces: {
            screens: {
              ListeAnnonces: pathFor('PROPERTY_LIST'),
              DetailAnnonce: pathFor('PROPERTY_DETAILS'),
              Notifications: pathFor('ADMIN_NOTIFICATIONS'),
            },
          },
          Visites: pathFor('VISITS'),
          Messages: { screens: { Conversations: pathFor('MESSAGES'), Chat: pathFor('CONVERSATION') } },
          Profil: {
            screens: {
              ProfilHome: pathFor('PROFILE'), MesAnnonces: pathFor('MY_PROPERTIES'),
              Transactions: pathFor('PAYMENTS'), RealEstateApplications: pathFor('APPLICATIONS'),
              RealEstateApplicationDetail: pathFor('APPLICATION_DETAILS'),
              PaiementCancel: pathFor('PAYMENT_CANCEL'),
              MyHotelReservations: pathFor('HOTEL_RESERVATIONS'),
              MyAccommodationReservations: pathFor('ACCOMMODATION_RESERVATIONS'),
              AccommodationReservationDetail: pathFor('ACCOMMODATION_RESERVATION_DETAILS'),
              AccommodationBooking: pathFor('ACCOMMODATION_BOOKING'),
              MyDocuments: pathFor('MY_DOCUMENTS'),
              PersonalDocumentDetail: pathFor('MY_DOCUMENT_DETAILS'),
              TenantPortal: { path: 'espace-locataire/:section?' },
              // POST-E2E-1 — ces 4 écrans hôteliers sont déclarés avec un
              // `deepLink` réel dans shared/navigation/registry.json
              // (HOTEL_OPERATIONS/HOTEL_COCKPIT/HOUSEKEEPING/HOTEL_MAINTENANCE)
              // mais n'étaient jamais câblés ici : un deep-link vers un hôtel
              // était donc silencieusement ignoré par React Navigation (aucun
              // écran ne matchait le chemin), reproduit et confirmé 2/2 lors
              // de ce sprint (POST_E2E1_REPORT.md).
              HotelOperations: pathFor('HOTEL_OPERATIONS'),
              HotelCockpit: pathFor('HOTEL_COCKPIT'),
              HotelHousekeeping: pathFor('HOUSEKEEPING'),
              HotelMaintenance: pathFor('HOTEL_MAINTENANCE'),
            },
          },
        },
      },
    },
  },
};
